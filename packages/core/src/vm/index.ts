/**
 * AiVM — AI Virtual Machine
 *
 * Executes .aibc bytecode by sending each intent to an LLM via
 * Vercel AI SDK. Runtime-agnostic: swap provider via env vars.
 *
 * Supports: Anthropic Claude, Amazon Nova Micro/Lite/Pro, Google Gemini
 * All routed optionally through Cloudflare AI Gateway.
 */

import { generateText, streamText, type LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import type { AibcBytecode, AibcIntent, VmExecutionResult, VmRunResult } from '../types/index.js';

export interface AiVmConfig {
  // Provider selection
  provider?: 'anthropic' | 'bedrock' | 'google-vertex';
  model?: string;
  // Cloudflare AI Gateway base URL (optional — routes all calls through CF Gateway)
  cfGatewayUrl?: string;
  // API keys
  anthropicApiKey?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsRegion?: string;
}

export class AiVM {
  private config: AiVmConfig;

  constructor(config: AiVmConfig = {}) {
    this.config = {
      provider: 'anthropic',
      model: 'claude-opus-4-5',
      ...config,
    };
  }

  private getModel(): LanguageModel {
    const { provider, model, cfGatewayUrl, anthropicApiKey, awsAccessKeyId, awsSecretAccessKey, awsRegion } = this.config;

    switch (provider) {
      case 'anthropic': {
        const baseURL = cfGatewayUrl
          ? `${cfGatewayUrl}/anthropic`
          : undefined;
        const anthropic = createAnthropic({
          apiKey: anthropicApiKey,
          ...(baseURL && { baseURL }),
        });
        return anthropic(model ?? 'claude-opus-4-5');
      }

      case 'bedrock': {
        const baseURL = cfGatewayUrl
          ? `${cfGatewayUrl}/aws-bedrock`
          : undefined;
        const bedrock = createAmazonBedrock({
          region: awsRegion ?? 'eu-west-1',
          accessKeyId: awsAccessKeyId,
          secretAccessKey: awsSecretAccessKey,
          ...(baseURL && { baseURL }),
        });
        return bedrock(model ?? 'us.amazon.nova-micro-v1:0');
      }

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private buildSystemPrompt(bytecode: AibcBytecode): string {
    const toolList = bytecode.tools.length
      ? `\nAvailable tools/services:\n${bytecode.tools.map(t => `- ${t}`).join('\n')}`
      : '';

    const ctx = bytecode.context
      ? `\nProject context:\n${bytecode.context}`
      : '';

    return `You are an AI VM — an intelligent runtime that executes intent directly.
You receive a named intent with a natural language description and produce a precise result.
Be concise, accurate, and faithful to the described intent. Do not add unsolicited commentary.${ctx}${toolList}`;
  }

  private buildIntentMessage(intent: AibcIntent, inputs: Record<string, string> = {}): string {
    const inputStr = Object.keys(inputs).length
      ? `\nInputs:\n${Object.entries(inputs).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
      : '';

    const outputStr = intent.output.length
      ? `\nExpected output:\n${intent.output.map(o => `- ${o}`).join('\n')}`
      : '';

    return `INTENT: ${intent.name}\n\n${intent.description}${inputStr}${outputStr}`;
  }

  async execute(
    bytecode: AibcBytecode,
    intentName: string,
    inputs: Record<string, string> = {}
  ): Promise<VmExecutionResult> {
    const intent = bytecode.intents.find(i => i.name === intentName);
    if (!intent) throw new Error(`Intent '${intentName}' not found in bytecode`);

    const model = this.getModel();
    const system = this.buildSystemPrompt(bytecode);
    const prompt = this.buildIntentMessage(intent, inputs);
    const start = Date.now();

    const result = await generateText({
      model,
      system,
      prompt,
      maxOutputTokens: 4096,
      experimental_telemetry: { isEnabled: false },
    });

    return {
      intentId: intent.id,
      intentName: intent.name,
      output: result.text,
      model: this.config.model ?? 'unknown',
      tokensUsed: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0),
      durationMs: Date.now() - start,
    };
  }

  async executeAll(
    bytecode: AibcBytecode,
    inputsMap: Record<string, Record<string, string>> = {}
  ): Promise<VmRunResult> {
    const start = Date.now();
    const results: VmExecutionResult[] = [];

    for (const intent of bytecode.intents) {
      const result = await this.execute(bytecode, intent.name, inputsMap[intent.name] ?? {});
      results.push(result);
    }

    return {
      module: bytecode.module,
      results,
      totalTokens: results.reduce((sum, r) => sum + r.tokensUsed, 0),
      totalDurationMs: Date.now() - start,
    };
  }

  /**
   * Stream a single intent execution — for use in the web demo
   */
  streamExecute(
    bytecode: AibcBytecode,
    intentName: string,
    inputs: Record<string, string> = {}
  ) {
    const intent = bytecode.intents.find(i => i.name === intentName);
    if (!intent) throw new Error(`Intent '${intentName}' not found in bytecode`);

    const model = this.getModel();
    const system = this.buildSystemPrompt(bytecode);
    const prompt = this.buildIntentMessage(intent, inputs);

    return streamText({
      model,
      system,
      prompt,
      maxOutputTokens: 4096,
      experimental_telemetry: { isEnabled: false },
    });
  }
}
