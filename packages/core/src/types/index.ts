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

// ─── .aix opcode types ────────────────────────────────────────────────────────

export type AixAction =
  | 'READ'
  | 'WRITE'
  | 'UPDATE'
  | 'DELETE'
  | 'VALIDATE'
  | 'SEND'
  | 'CALL'
  | 'TRANSFORM';

export type OnFailAction = 'HALT' | 'LOG' | 'RETRY' | 'SKIP';

export interface AixCheck {
  condition: string;
  on_fail: string; // human-readable failure message
}

export interface AixOnFail {
  condition?: string;
  message?: string;
  action: OnFailAction;
}

export interface AixStep {
  id: string;                          // step_1, step_2 …
  name: string;                        // PascalCase from .aic heading
  intent: string;                      // zero-ambiguity rewrite by compiler
  tool: string | null;                 // tool name or null
  action: AixAction;
  inputs: Record<string, string>;      // field → $input.x or $step_N.field or literal
  checks?: AixCheck[];                // VALIDATE steps only
  outputs: Record<string, string>;     // field → description of what is stored
  on_fail: AixOnFail;
  compiler_note?: string;              // assumption compiler made
}

export interface AixFile {
  workflow: string;
  version: '1.0';
  compiled_at: string;                 // ISO 8601
  compiler_version: string;
  source_hash: string;                 // sha256 of .aic source
  inputs: Record<string, string>;
  tools: Record<string, string>;
  steps: AixStep[];
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

export type SupportedProvider = 'anthropic' | 'bedrock' | 'workers-ai';

export interface ProviderConfig {
  provider: SupportedProvider;
  model: string;
  cfGatewayUrl?: string;
}

// ─── Lock file ────────────────────────────────────────────────────────────────

export interface LockFile {
  compiled_at: string;
  source_hash: string;
  aix: AixFile;
}
