/**
 * aiCompiler — .aic → .aix
 *
 * Sends the parsed workflow to Claude with a strict compilation prompt.
 * Claude resolves ALL ambiguity and produces zero-ambiguity .aix JSON.
 * The LLM is the compiler — not a helper.
 */

import { createHash } from 'crypto';
import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import type { AicWorkflow, AixFile, LockFile, ProviderConfig } from '../types/index.js';

const COMPILER_VERSION = '0.1.0';

// ─── Compilation prompt ───────────────────────────────────────────────────────

function buildCompilationPrompt(workflow: AicWorkflow, context?: string): string {
  const contextBlock = context
    ? `\n\nProject context (use this to resolve ambiguities):\n${context}`
    : '';

  return `You are aiCompiler. Convert the .aic workflow below into a precise .aix JSON execution file.

RULES:
- Every step must have: id (step_1, step_2...), name, intent, tool, action, inputs, outputs, on_fail
- Resolve ALL ambiguity — make the most logical, precise decision
- Add compiler_note if you made an assumption the developer should know about
- Resolve all {references} in step descriptions to their source: use $input.fieldName or $step_N.outputField
- Return ONLY valid JSON. No explanation. No markdown fences. No comments.
- Never add steps not in the spec
- tool must be null if the step uses no external tool
- action must be one of: READ, WRITE, UPDATE, DELETE, VALIDATE, SEND, CALL, TRANSFORM
- on_fail.action must be one of: HALT, LOG, RETRY, SKIP
- Default on_fail action is HALT unless the spec says otherwise (e.g. "log the error but continue")
- inputs values must use $input.field or $step_N.field syntax for references, or plain string literals

WORKFLOW TO COMPILE:
${formatWorkflowForPrompt(workflow)}${contextBlock}

OUTPUT FORMAT (return exactly this structure, filled in):
{
  "workflow": "<name>",
  "version": "1.0",
  "compiled_at": "<ISO timestamp>",
  "compiler_version": "${COMPILER_VERSION}",
  "source_hash": "<will be set by compiler>",
  "inputs": { "<name>": "<description>" },
  "tools": { "<name>": "<description>" },
  "steps": [
    {
      "id": "step_1",
      "name": "<PascalCase>",
      "intent": "<zero-ambiguity single sentence>",
      "tool": "<toolName or null>",
      "action": "<ACTION>",
      "inputs": { "<field>": "<$input.x or $step_N.field or literal>" },
      "outputs": { "<field>": "<what this field contains>" },
      "on_fail": { "condition": "<optional>", "message": "<optional>", "action": "HALT|LOG|RETRY|SKIP" },
      "compiler_note": "<optional — only if assumption was made>"
    }
  ]
}`;
}

function formatWorkflowForPrompt(workflow: AicWorkflow): string {
  const inputs = Object.entries(workflow.inputs)
    .map(([k, v]) => `  - ${k}: ${v}`)
    .join('\n');

  const tools = Object.entries(workflow.tools)
    .map(([k, v]) => `  - ${k}: ${v}`)
    .join('\n');

  const steps = workflow.steps
    .map((s, i) => `  ### ${i + 1}. ${s.name}\n  ${s.description}`)
    .join('\n\n');

  return `# Workflow: ${workflow.name}

## Description
${workflow.description}

## Inputs
${inputs || '  (none)'}

## Tools
${tools || '  (none)'}

## Steps
${steps}`;
}

// ─── Compiler ─────────────────────────────────────────────────────────────────

export interface CompilerOptions {
  provider?: ProviderConfig;
  context?: string;
  workersAiBinding?: any;   // CF AI binding — passed through to model factory
  anthropicApiKey?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsRegion?: string;
  cfGatewayUrl?: string;
}

function getModel(opts: CompilerOptions) {
  const provider = opts.provider?.provider ?? 'workers-ai';
  const model    = opts.provider?.model;
  const baseURL  = opts.cfGatewayUrl;

  if (provider === 'workers-ai') {
    const { createOpenAI } = require('@ai-sdk/openai');
    const binding = opts.workersAiBinding as { accountId: string; apiToken: string };
    const cfOpenAI = createOpenAI({
      baseURL: `https://api.cloudflare.com/client/v4/accounts/${binding.accountId}/ai/v1`,
      apiKey: binding.apiToken,
    });
    return cfOpenAI(model ?? '@cf/meta/llama-3.3-70b-instruct-fp8-fast');
  }

  if (provider === 'anthropic') {
    const anthropic = createAnthropic({
      apiKey: opts.anthropicApiKey,
      ...(baseURL && { baseURL: `${baseURL}/anthropic` }),
    });
    return anthropic(model ?? 'claude-opus-4-5');
  }

  if (provider === 'bedrock') {
    const bedrock = createAmazonBedrock({
      region: opts.awsRegion ?? 'eu-west-1',
      accessKeyId: opts.awsAccessKeyId,
      secretAccessKey: opts.awsSecretAccessKey,
      ...(baseURL && { baseURL: `${baseURL}/aws-bedrock` }),
    });
    return bedrock(model ?? 'us.amazon.nova-micro-v1:0');
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

export async function compile(
  workflow: AicWorkflow,
  sourceText: string,
  opts: CompilerOptions = {}
): Promise<AixFile> {
  const prompt = buildCompilationPrompt(workflow, opts.context);
  const hash   = createHash('sha256').update(sourceText).digest('hex').slice(0, 16);
  const provider = opts.provider?.provider ?? 'workers-ai';

  let text: string;

  if (provider === 'workers-ai') {
    // Call CF Workers AI REST API directly — avoids AI SDK compat issues
    const binding = opts.workersAiBinding as { accountId: string; apiToken: string };
    const model   = opts.provider?.model ?? '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${binding.accountId}/ai/run/${model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${binding.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], max_tokens: 8192 }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Workers AI error ${res.status}: ${err}`);
    }
    const data = await res.json() as any;
    // CF REST API returns: result.response (string) or result.choices[0].message.content
    const raw = data?.result?.response ?? data?.result?.choices?.[0]?.message?.content ?? data?.response ?? '';
    text = typeof raw === 'string' ? raw : JSON.stringify(raw);
    if (!text) throw new Error(`Workers AI returned empty response: ${JSON.stringify(data).slice(0, 200)}`);
  } else {
    // Anthropic / Bedrock via Vercel AI SDK
    const model = getModel(opts);
    const result = await generateText({
      model,
      messages: [{ role: 'user', content: prompt }],
      maxOutputTokens: 8192,
      experimental_telemetry: { isEnabled: false },
    });
    text = result.text;
  }

  // strip any accidental markdown fences
  const cleaned = text
    .replace(/^```json\s*/m, '')
    .replace(/^```\s*/m, '')
    .replace(/```\s*$/m, '')
    .trim();

  let aix: AixFile;
  try {
    aix = JSON.parse(cleaned) as AixFile;
  } catch {
    throw new Error(`Compiler returned invalid JSON.\n\nRaw output:\n${text.slice(0, 500)}`);
  }

  aix.source_hash      = hash;
  aix.compiled_at      = new Date().toISOString();
  aix.compiler_version = COMPILER_VERSION;

  return aix;
}

// ─── Lock file helpers ────────────────────────────────────────────────────────

export function buildLockFile(sourceText: string, aix: AixFile): LockFile {
  return {
    compiled_at: new Date().toISOString(),
    source_hash: aix.source_hash,
    aix,
  };
}

export function isLockValid(sourceText: string, lock: LockFile): boolean {
  const hash = createHash('sha256').update(sourceText).digest('hex').slice(0, 16);
  return hash === lock.source_hash;
}
