// .aic file types

export interface AicIntent {
  name: string;
  description: string;
  input: string[];
  output: string[];
}

export interface AicSpec {
  module: string;
  version: string;
  context: string;
  tools: string[];
  intents: AicIntent[];
}

// .aibc bytecode types

export interface AibcIntent {
  id: string;
  name: string;
  description: string;
  input: string[];
  output: string[];
  // enriched at compile time
  resolvedTools: string[];
  provider?: string;
  model?: string;
  cacheHint?: boolean;
  retryCount?: number;
}

export interface AibcBytecode {
  version: '1.0';
  module: string;
  context: string;
  tools: string[];
  compiledAt: string;
  sourceHash: string;
  intents: AibcIntent[];
}

// VM execution types

export interface VmExecutionResult {
  intentId: string;
  intentName: string;
  output: string;
  model: string;
  tokensUsed: number;
  durationMs: number;
}

export interface VmRunResult {
  module: string;
  results: VmExecutionResult[];
  totalTokens: number;
  totalDurationMs: number;
}

// Provider config
export type SupportedProvider = 'anthropic' | 'bedrock' | 'google-vertex' | 'workers-ai';

export interface ProviderConfig {
  provider: SupportedProvider;
  model: string;
  gatewayUrl?: string;
}
