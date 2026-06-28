// ─── .aic source language types ───────────────────────────────────────────────

export interface AicStep {
  name: string;
  description: string; // raw plain-English from the .aic file
}

export interface AicWorkflow {
  name: string;
  description: string;
  inputs: Record<string, string>;  // inputName → description
  tools: Record<string, string>;   // toolName  → description
  steps: AicStep[];
}

// ─── .aiop opcode types ────────────────────────────────────────────────────────

export type AiopAction =
  | 'READ'
  | 'WRITE'
  | 'UPDATE'
  | 'DELETE'
  | 'VALIDATE'
  | 'SEND'
  | 'CALL'
  | 'TRANSFORM';

export type OnFailAction = 'HALT' | 'LOG' | 'RETRY' | 'SKIP';

export interface AiopCheck {
  condition: string;
  on_fail: string; // human-readable failure message
}

export interface AiopOnFail {
  condition?: string;
  message?: string;
  action: OnFailAction;
}

export interface AiopStep {
  id: string;                          // step_1, step_2 …
  name: string;                        // PascalCase from .aic heading
  intent: string;                      // zero-ambiguity rewrite by compiler
  tool: string | null;                 // tool name or null
  action: AiopAction;
  inputs: Record<string, string>;      // field → $input.x or $step_N.field or literal
  checks?: AiopCheck[];                // VALIDATE steps only
  outputs: Record<string, string>;     // field → description of what is stored
  on_fail: AiopOnFail;
  compiler_note?: string;              // assumption compiler made
}

export interface AiopFile {
  workflow: string;
  version: '1.0';
  compiled_at: string;                 // ISO 8601
  compiler_version: string;
  source_hash: string;                 // sha256 of .aic source
  inputs: Record<string, string>;
  tools: Record<string, string>;
  steps: AiopStep[];
}

// ─── aiVM execution types ──────────────────────────────────────────────────────

export type StepStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'LOGGED';

export interface StepExecutionResult {
  id: string;
  name: string;
  status: StepStatus;
  duration_ms: number;
  output: Record<string, unknown>;
  error?: string;
  simulated?: boolean;
}

export interface WorkflowExecutionResult {
  workflow: string;
  started_at: string;
  completed_at: string;
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  inputs: Record<string, string>;
  steps: StepExecutionResult[];
  error?: string;
}

// ─── Provider config ──────────────────────────────────────────────────────────

export type SupportedProvider = 'anthropic' | 'bedrock';

export interface ProviderConfig {
  provider: SupportedProvider;
  model: string;
  cfGatewayUrl?: string;
}

// ─── Lock file ────────────────────────────────────────────────────────────────

export interface LockFile {
  compiled_at: string;
  source_hash: string;
  aiop: AiopFile;
}
