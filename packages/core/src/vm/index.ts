/**
 * aiVM — AI Virtual Machine
 *
 * Executes .aiop bytecode step by step.
 * The LLM is the CPU — it executes each opcode via Vercel AI SDK.
 *
 * Reuses:   Vercel AI SDK generateText (LLM calls per step)
 * Builds:   step loop, $ref resolver, HALT/LOG/RETRY/SKIP, execution log
 */

import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import type {
  AiopFile,
  AiopStep,
  StepExecutionResult,
  StepStatus,
  WorkflowExecutionResult,
  ProviderConfig,
} from '../types/index.js';

// ─── Config ───────────────────────────────────────────────────────────────────

export interface AiVMConfig {
  provider?: ProviderConfig;
  simulate?: boolean;
  // Workers AI binding (passed from CF Worker env)
  workersAiBinding?: any;
  // Other provider credentials
  anthropicApiKey?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsRegion?: string;
  cfGatewayUrl?: string;
}

// ─── $ref resolver ────────────────────────────────────────────────────────────
// Resolves $input.field and $step_N.field references from execution state

type ExecutionState = {
  input: Record<string, string>;
  steps: Record<string, Record<string, unknown>>;  // step_1 → { field: value }
};

function resolveRefs(value: string, state: ExecutionState): string {
  return value.replace(/\$input\.(\w+)/g, (_, field) => {
    return String(state.input[field] ?? `[unresolved: $input.${field}]`);
  }).replace(/\$step_(\d+)\.(\w+(?:\.\w+)*)/g, (_, stepNum, field) => {
    const stepKey = `step_${stepNum}`;
    const stepOutput = state.steps[stepKey];
    if (!stepOutput) return `[unresolved: $step_${stepNum}.${field}]`;
    // support nested dot access: $step_1.order.total
    const val = field.split('.').reduce((obj: any, k: string) => obj?.[k], stepOutput);
    return val !== undefined ? String(val) : `[unresolved: $step_${stepNum}.${field}]`;
  });
}

function resolveStepInputs(
  inputs: Record<string, string>,
  state: ExecutionState
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, val] of Object.entries(inputs)) {
    resolved[key] = typeof val === 'string' ? resolveRefs(val, state) : String(val);
  }
  return resolved;
}

// ─── Step execution prompt ────────────────────────────────────────────────────

function buildStepPrompt(
  aiop: AiopFile,
  step: AiopStep,
  resolvedInputs: Record<string, string>,
  state: ExecutionState
): string {
  const priorOutputs = Object.entries(state.steps)
    .map(([id, out]) => `${id}: ${JSON.stringify(out)}`)
    .join('\n');

  const toolDesc = step.tool
    ? `Tool: ${step.tool} — ${aiop.tools[step.tool] ?? 'no description'}`
    : 'Tool: none required';

  const checks = step.checks?.length
    ? `\nChecks to perform:\n${step.checks.map(c => `- ${c.condition} → fail: "${c.on_fail}"`).join('\n')}`
    : '';

  const expectedOutputs = Object.entries(step.outputs)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  return `You are aiVM executing one step of a workflow. Execute exactly what the step says.

Workflow: ${aiop.workflow}
Step ${step.id}: ${step.name}
Intent: ${step.intent}
Action: ${step.action}
${toolDesc}

Resolved inputs:
${JSON.stringify(resolvedInputs, null, 2)}
${checks}

Prior step outputs available:
${priorOutputs || '(none — this is the first step)'}

Expected output fields:
${expectedOutputs}

Execute this step precisely. Return ONLY this JSON, no explanation:
{
  "success": true,
  "output": { ${Object.keys(step.outputs).map(k => `"${k}": <value>`).join(', ')} },
  "error": null
}

If the step fails based on its on_fail condition, return:
{
  "success": false,
  "output": {},
  "error": "<failure message from the spec>"
}`;
}

// ─── Simulation ───────────────────────────────────────────────────────────────
// Generates realistic mock output for each step without a real LLM call

function simulateStep(step: AiopStep, resolvedInputs: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [field, desc] of Object.entries(step.outputs)) {
    const low = desc.toLowerCase();
    if (low.includes('boolean') || low.includes('true'))        out[field] = true;
    else if (low.includes('id') || field.toLowerCase().includes('id'))
      out[field] = `mock_${field}_${Date.now()}`;
    else if (low.includes('email'))   out[field] = 'customer@example.com';
    else if (low.includes('amount') || low.includes('total'))   out[field] = 49.99;
    else if (low.includes('array') || low.includes('list'))     out[field] = [];
    else if (low.includes('status'))  out[field] = 'SUCCESS';
    else if (low.includes('record') || low.includes('object')) {
      out[field] = {
        id: `mock_id_${Date.now()}`,
        status: 'PENDING',
        total: 49.99,
        customerEmail: 'customer@example.com',
        createdAt: new Date().toISOString(),
        paymentId: `pay_mock_${Date.now()}`,
        ...resolvedInputs,
      };
    }
    else out[field] = `mock_${field}`;
  }
  return out;
}

// ─── aiVM ─────────────────────────────────────────────────────────────────────

export class AiVM {
  private config: AiVMConfig;

  constructor(config: AiVMConfig = {}) {
    this.config = { provider: { provider: 'anthropic', model: 'claude-opus-4-5' }, ...config };
  }

  private getModel() {
    const p  = this.config.provider!;
    const gw = this.config.cfGatewayUrl;

    if (p.provider === 'workers-ai') {
      // Cloudflare Workers AI via OpenAI-compatible REST endpoint
      // baseURL: https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1
      // workersAiBinding is the account_id + api_token pair passed as { accountId, apiToken }
      const { createOpenAI } = require('@ai-sdk/openai');
      const binding = this.config.workersAiBinding as { accountId: string; apiToken: string };
      const cfOpenAI = createOpenAI({
        baseURL: `https://api.cloudflare.com/client/v4/accounts/${binding.accountId}/ai/v1`,
        apiKey: binding.apiToken,
      });
      return cfOpenAI(p.model ?? '@cf/meta/llama-3.3-70b-instruct-fp8-fast');
    }

    if (p.provider === 'anthropic') {
      const anthropic = createAnthropic({
        apiKey: this.config.anthropicApiKey,
        ...(gw && { baseURL: `${gw}/anthropic` }),
      });
      return anthropic(p.model ?? 'claude-opus-4-5');
    }

    if (p.provider === 'bedrock') {
      const bedrock = createAmazonBedrock({
        region: this.config.awsRegion ?? 'eu-west-1',
        accessKeyId: this.config.awsAccessKeyId,
        secretAccessKey: this.config.awsSecretAccessKey,
        ...(gw && { baseURL: `${gw}/aws-bedrock` }),
      });
      return bedrock(p.model ?? 'us.amazon.nova-micro-v1:0');
    }

    throw new Error(`Unsupported provider: ${p.provider}`);
  }

  /**
   * Execute a single step — public so the stream handler can call it per-step.
   * Borrowed pattern: AgentStep status transitions from versatile-execution-agent.
   * state is mutated in place so subsequent steps can reference earlier outputs.
   */
  async runStep(
    aiop: AiopFile,
    step: AiopStep,
    inputs: Record<string, string>,
    priorResults: StepExecutionResult[],
    state?: ExecutionState
  ): Promise<StepExecutionResult> {
    // build state from prior results if not passed in
    if (!state) {
      state = { input: inputs, steps: {} };
      for (const r of priorResults) {
        state.steps[r.id] = r.output;
      }
    }

    const stepStart = Date.now();
    const resolvedInputs = resolveStepInputs(step.inputs, state);

    // ── simulate mode ────────────────────────────────────────────────────────
    if (this.config.simulate) {
      await new Promise(r => setTimeout(r, 200 + Math.random() * 400));
      const output = simulateStep(step, resolvedInputs);
      state.steps[step.id] = output;
      return { id: step.id, name: step.name, status: 'SUCCESS', duration_ms: Date.now() - stepStart, output, simulated: true };
    }

    // ── real LLM execution ───────────────────────────────────────────────────
    const maxAttempts = step.on_fail.action === 'RETRY' ? 3 : 1;
    let lastError = '';
    let stepStatus: StepStatus = 'FAILED';
    let stepOutput: Record<string, unknown> = {};

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        let text: string;

        if (this.config.provider?.provider === 'workers-ai') {
          // Direct REST call — bypasses AI SDK compat issues
          const binding = this.config.workersAiBinding as { accountId: string; apiToken: string };
          const model   = this.config.provider.model ?? '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
          const res = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${binding.accountId}/ai/run/${model}`,
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${binding.apiToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ messages: [{ role: 'user', content: buildStepPrompt(aiop, step, resolvedInputs, state) }], max_tokens: 2048 }),
            }
          );
          if (!res.ok) throw new Error(`Workers AI ${res.status}: ${await res.text()}`);
          const data = await res.json() as any;
          const raw = data?.result?.response ?? data?.result?.choices?.[0]?.message?.content ?? data?.response ?? '';
          text = typeof raw === 'string' ? raw : JSON.stringify(raw);
          if (!text) throw new Error(`Workers AI empty response`);
        } else {
          const result = await generateText({
            model: this.getModel(),
            messages: [{ role: 'user', content: buildStepPrompt(aiop, step, resolvedInputs, state) }],
            maxOutputTokens: 2048,
            experimental_telemetry: { isEnabled: false },
          });
          text = result.text;
        }

        const cleaned = text
          .replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```\s*$/m, '').trim();
        const parsed = JSON.parse(cleaned) as { success: boolean; output: Record<string, unknown>; error: string | null };

        if (parsed.success) {
          stepOutput = parsed.output;
          stepStatus = 'SUCCESS';
          state.steps[step.id] = stepOutput;
          lastError = '';
          break;
        } else {
          lastError = parsed.error ?? 'Step returned failure';
        }
      } catch (err: any) {
        lastError = err.message ?? 'Unknown error';
      }
    }

    // ── on_fail handling ─────────────────────────────────────────────────────
    if (stepStatus === 'FAILED') {
      const action = step.on_fail.action;
      state.steps[step.id] = {};

      if (action === 'LOG') {
        return { id: step.id, name: step.name, status: 'LOGGED',  duration_ms: Date.now() - stepStart, output: {}, error: lastError };
      }
      if (action === 'SKIP') {
        return { id: step.id, name: step.name, status: 'SKIPPED', duration_ms: Date.now() - stepStart, output: {} };
      }
      // HALT or RETRY exhausted
      return { id: step.id, name: step.name, status: 'FAILED', duration_ms: Date.now() - stepStart, output: {}, error: step.on_fail.message ?? lastError };
    }

    return { id: step.id, name: step.name, status: 'SUCCESS', duration_ms: Date.now() - stepStart, output: stepOutput };
  }

  /**
   * Run the full workflow — calls runStep for each step in sequence.
   * Stops on FAILED (HALT), continues on LOGGED/SKIPPED.
   */
  async run(
    aiop: AiopFile,
    inputs: Record<string, string> = {}
  ): Promise<WorkflowExecutionResult> {
    const startedAt = new Date().toISOString();
    const stepResults: StepExecutionResult[] = [];
    const state: ExecutionState = { input: inputs, steps: {} };
    let workflowStatus: WorkflowExecutionResult['status'] = 'SUCCESS';
    let workflowError: string | undefined;

    for (const step of aiop.steps) {
      const result = await this.runStep(aiop, step, inputs, stepResults, state);
      stepResults.push(result);

      if (result.status === 'FAILED') {
        workflowStatus = 'FAILED';
        workflowError = result.error;
        break;
      }
      if (result.status === 'LOGGED') workflowStatus = 'PARTIAL';
    }

    return {
      workflow: aiop.workflow,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      status: workflowStatus,
      inputs,
      steps: stepResults,
      ...(workflowError && { error: workflowError }),
    };
  }
}
