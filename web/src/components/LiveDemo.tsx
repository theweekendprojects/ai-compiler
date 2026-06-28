/**
 * LiveDemo — 3-panel playground
 *
 * Panel 1: Monaco editor (.aic source)
 * Panel 2: .aix bytecode viewer
 * Panel 3: Step-by-step execution log
 *
 * Step status pattern adapted from:
 * ai-showcase/gemini-aishowcase/versatile-execution-agent/src/services/gemini.ts
 * (AgentStep interface + onUpdate streaming pattern)
 */

import { useState, useRef, useCallback } from "react";
import Editor from "@monaco-editor/react";

const WORKER_URL = import.meta.env.PUBLIC_WORKER_URL ?? "https://aivm-worker.theweekendprojects.workers.dev";

// ─── Examples ─────────────────────────────────────────────────────────────────

const EXAMPLES = {
  refund: `# Workflow: ProcessRefund

## Description
Processes a customer refund. Validates eligibility,
issues the refund, updates the order record,
and notifies the customer by email.

## Inputs
- orderId: the unique identifier of the order to refund

## Tools
- database: PostgreSQL — orders and customers tables
- payment: Stripe API — for issuing refunds
- email: SendGrid — for transactional emails

## Steps

### 1. LoadOrder
Load the order record from the database using {orderId}.
Fail with "Order not found" if no record exists.

### 2. ValidateRefund
Check that {LoadOrder.status} is not "REFUNDED".
Check that {LoadOrder.createdAt} is within the last 30 days.
Fail with "Refund not eligible" if either check fails.

### 3. IssueRefund
Call the payment tool to refund {LoadOrder.total} for {LoadOrder.paymentId}.
Store the returned confirmation id as refundConfirmationId.
Fail with "Payment refund failed" if the tool returns an error.

### 4. UpdateOrder
Update the order record in the database.
Set status to "REFUNDED".
Set refundConfirmationId to {IssueRefund.refundConfirmationId}.

### 5. NotifyCustomer
Send a confirmation email to {LoadOrder.customerEmail}.
Include the refund amount {LoadOrder.total} and {IssueRefund.refundConfirmationId}.
If email fails, log the error but do not halt the workflow.`,

  createUser: `# Workflow: CreateUser

## Description
Creates a new user account, sends a welcome email,
and sets up their default preferences.

## Inputs
- name: the user's full name
- email: the user's email address

## Tools
- database: PostgreSQL — users table
- email: SendGrid — for transactional emails

## Steps

### 1. CheckEmailExists
Check the database to ensure no user with {email} already exists.
Fail with "Email already registered" if a user is found.

### 2. CreateAccount
Insert a new user record with {name} and {email}.
Generate a unique userId.

### 3. SetDefaultPreferences
Create a default preferences record for {CreateAccount.userId}.
Set theme to "light", language to "en", notifications to true.

### 4. SendWelcomeEmail
Send a welcome email to {email}.
Address the user by {name}.
Include their new account details and a getting-started guide link.
If email fails, log the error but do not halt the workflow.`,
};

// ─── Types (adapted from AgentStep in versatile-execution-agent) ──────────────

type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'logged' | 'skipped';

interface LiveStep {
  id: string;
  name: string;
  status: StepStatus;
  duration_ms?: number;
  output?: Record<string, unknown>;
  error?: string;
  simulated?: boolean;
}

type Panel = 'source' | 'aix' | 'execution';
type ExampleKey = keyof typeof EXAMPLES;

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_ICON: Record<StepStatus, string> = {
  pending:  '○',
  running:  '◉',
  success:  '✓',
  failed:   '✗',
  logged:   '⚠',
  skipped:  '—',
};

const STATUS_COLOR: Record<StepStatus, string> = {
  pending:  'text-[var(--color-muted)]',
  running:  'text-[var(--color-accent)]',
  success:  'text-[var(--color-accent-2)]',
  failed:   'text-red-400',
  logged:   'text-yellow-400',
  skipped:  'text-[var(--color-muted)]',
};

const STATUS_BG: Record<StepStatus, string> = {
  pending:  'bg-transparent',
  running:  'bg-cyan-500/10 border-cyan-500/30',
  success:  'bg-emerald-500/10 border-emerald-500/30',
  failed:   'bg-red-500/10 border-red-500/30',
  logged:   'bg-yellow-500/10 border-yellow-500/30',
  skipped:  'bg-transparent border-[var(--color-border)]',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function LiveDemo() {
  const [source, setSource] = useState(EXAMPLES.refund);
  const [activePanel, setActivePanel] = useState<Panel>('source');
  const [aix, setaix] = useState<object | null>(null);
  const [steps, setSteps] = useState<LiveStep[]>([]);
  const [workflowStatus, setWorkflowStatus] = useState<'idle' | 'compiling' | 'running' | 'success' | 'failed' | 'partial'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [simulate, setSimulate] = useState(true); // default: simulation for demo
  const logRef = useRef<HTMLDivElement>(null);

  // scroll execution log to bottom — pattern from live-panel/ResponseDisplay.tsx
  const scrollLog = () => {
    setTimeout(() => {
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
  };

  // notify pattern from versatile-execution-agent — fires on every step update
  const updateStep = useCallback((id: string, patch: Partial<LiveStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
    scrollLog();
  }, []);

  const compileAndRun = useCallback(async () => {
    setError(null);
    setaix(null);
    setSteps([]);
    setWorkflowStatus('compiling');
    setActivePanel('execution');

    try {
      const res = await fetch(`${WORKER_URL}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, simulate }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Request failed');
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            switch (event.type) {
              case 'compiling':
                setWorkflowStatus('compiling');
                break;

              case 'compiled':
                setaix(event.aix);
                setWorkflowStatus('running');
                // pre-populate all steps as pending — pattern from AgentStep
                setSteps(event.aix.steps.map((s: any) => ({
                  id: s.id, name: s.name, status: 'pending' as StepStatus,
                })));
                setActivePanel('execution');
                scrollLog();
                break;

              case 'step_start':
                updateStep(event.step.id, { status: 'running' });
                break;

              case 'step_done': {
                const s = event.step;
                updateStep(s.id, {
                  status: s.status.toLowerCase() as StepStatus,
                  duration_ms: s.duration_ms,
                  output: s.output,
                  error: s.error,
                  simulated: s.simulated,
                });
                break;
              }

              case 'workflow_done':
                setWorkflowStatus(event.result.status.toLowerCase() as any);
                break;

              case 'error':
                setError(event.message);
                setWorkflowStatus('failed');
                break;
            }
          } catch { /* ignore JSON parse errors on incomplete lines */ }
        }
      }
    } catch (err: any) {
      setError(err.message);
      setWorkflowStatus('failed');
    }
  }, [source, simulate, updateStep]);

  const compileOnly = useCallback(async () => {
    setError(null);
    setaix(null);
    setWorkflowStatus('compiling');

    try {
      const res = await fetch(`${WORKER_URL}/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Compilation failed');
      setaix(data);
      setActivePanel('aix');
      setWorkflowStatus('idle');
    } catch (err: any) {
      setError(err.message);
      setWorkflowStatus('idle');
    }
  }, [source]);

  const isBusy = workflowStatus === 'compiling' || workflowStatus === 'running';
  const successCount = steps.filter(s => s.status === 'success').length;
  const failedCount  = steps.filter(s => s.status === 'failed').length;

  return (
    <div className="w-full max-w-7xl mx-auto px-4">

      {/* ── toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[var(--color-muted)]">Examples:</span>
          {(Object.keys(EXAMPLES) as ExampleKey[]).map(key => (
            <button
              key={key}
              onClick={() => {
                setSource(EXAMPLES[key]);
                setActivePanel('source');
                setaix(null);
                setSteps([]);
                setError(null);
                setWorkflowStatus('idle');
              }}
              className="badge badge-purple cursor-pointer hover:opacity-80 transition-opacity"
            >
              {key}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[var(--color-muted)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={simulate}
              onChange={e => setSimulate(e.target.checked)}
              className="accent-violet-500"
            />
            Simulation mode
          </label>
          {simulate && (
            <span className="badge badge-cyan text-xs">No real tools called</span>
          )}
        </div>
      </div>

      {/* ── 3-panel grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

        {/* Panel 1 — .aic source editor */}
        <div className="editor-pane flex flex-col" style={{ height: '480px' }}>
          <div className="editor-tab-bar">
            <span className="dot dot-red" /><span className="dot dot-yellow" /><span className="dot dot-green" />
            <button
              onClick={() => setActivePanel('source')}
              className={`ml-2 editor-tab ${activePanel === 'source' ? 'active' : ''}`}
            >
              workflow.aic
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              defaultLanguage="markdown"
              value={source}
              onChange={v => setSource(v ?? '')}
              theme="vs-dark"
              options={{
                fontSize: 12,
                fontFamily: 'JetBrains Mono, Fira Code, monospace',
                minimap: { enabled: false },
                lineNumbers: 'on',
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                padding: { top: 12, bottom: 12 },
                scrollbar: { verticalScrollbarSize: 4 },
              }}
            />
          </div>
        </div>

        {/* Panel 2 — .aix bytecode */}
        <div className="editor-pane flex flex-col" style={{ height: '480px' }}>
          <div className="editor-tab-bar">
            <span className="dot dot-red" /><span className="dot dot-yellow" /><span className="dot dot-green" />
            <button
              onClick={() => setActivePanel('aix')}
              className={`ml-2 editor-tab ${activePanel === 'aix' ? 'active' : ''}`}
            >
              workflow.aix
            </button>
          </div>
          <div className="flex-1 overflow-auto p-3">
            {!aix && workflowStatus !== 'compiling' && (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-[var(--color-muted)]">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                <p className="text-xs text-center">
                  Compile your <span className="text-[var(--color-primary-glow)]">.aic</span> file<br/>to see the AI opcodes
                </p>
              </div>
            )}
            {workflowStatus === 'compiling' && (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-[var(--color-accent)]">
                <Spinner />
                <p className="text-xs">Compiling with Claude...</p>
              </div>
            )}
            {aix && (
              <pre className="text-xs font-mono text-[var(--color-accent)] leading-relaxed overflow-auto whitespace-pre-wrap">
                {JSON.stringify(aix, null, 2)}
              </pre>
            )}
          </div>
        </div>

        {/* Panel 3 — execution log */}
        <div className="editor-pane flex flex-col" style={{ height: '480px' }}>
          <div className="editor-tab-bar">
            <span className="dot dot-red" /><span className="dot dot-yellow" /><span className="dot dot-green" />
            <button
              onClick={() => setActivePanel('execution')}
              className={`ml-2 editor-tab ${activePanel === 'execution' ? 'active' : ''}`}
            >
              execution log
            </button>
            {steps.length > 0 && (
              <div className="ml-auto flex gap-2">
                {successCount > 0 && <span className="badge badge-green text-xs">{successCount} ✓</span>}
                {failedCount > 0  && <span className="badge text-xs bg-red-500/10 text-red-400 border border-red-500/30">{failedCount} ✗</span>}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-2" ref={logRef}>
            {steps.length === 0 && workflowStatus === 'idle' && (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-[var(--color-muted)]">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor"/>
                </svg>
                <p className="text-xs text-center">
                  Click <span className="text-[var(--color-accent-2)]">Run</span> to execute<br/>the workflow step by step
                </p>
              </div>
            )}

            {steps.map(step => (
              <div
                key={step.id}
                className={`rounded-lg border p-3 transition-all duration-300 ${STATUS_BG[step.status]}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-sm font-bold ${STATUS_COLOR[step.status]}`}>
                      {step.status === 'running'
                        ? <span className="inline-flex"><Spinner small /></span>
                        : STATUS_ICON[step.status]
                      }
                    </span>
                    <span className="text-sm font-semibold">{step.name}</span>
                    <span className="text-xs text-[var(--color-muted)] font-mono">{step.id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {step.simulated && (
                      <span className="badge badge-cyan text-xs">simulated</span>
                    )}
                    {step.duration_ms !== undefined && (
                      <span className="text-xs text-[var(--color-muted)] font-mono">{step.duration_ms}ms</span>
                    )}
                  </div>
                </div>

                {/* step output */}
                {step.output && Object.keys(step.output).length > 0 && (
                  <pre className="mt-2 text-xs font-mono text-[var(--color-accent-2)] bg-black/20 rounded p-2 overflow-auto max-h-32">
                    {JSON.stringify(step.output, null, 2)}
                  </pre>
                )}

                {/* step error */}
                {step.error && (
                  <p className="mt-2 text-xs text-red-400 font-mono">✗ {step.error}</p>
                )}
              </div>
            ))}

            {/* workflow result summary */}
            {(workflowStatus === 'success' || workflowStatus === 'failed' || workflowStatus === 'partial') && (
              <div className={`rounded-lg border p-3 mt-2 text-sm font-semibold ${
                workflowStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                workflowStatus === 'partial' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' :
                'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
                {workflowStatus === 'success' ? '✓ Workflow completed successfully' :
                 workflowStatus === 'partial' ? '⚠ Workflow completed with logged errors' :
                 '✗ Workflow failed'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── error banner ── */}
      {error && (
        <div className="mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-mono">
          ✗ {error}
        </div>
      )}

      {/* ── actions ── */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button onClick={compileOnly} disabled={isBusy} className="btn-ghost">
          {workflowStatus === 'compiling' && !steps.length
            ? <><Spinner /> Compiling...</>
            : <><CompileIcon /> Compile → .aix</>
          }
        </button>
        <button onClick={compileAndRun} disabled={isBusy} className="btn-primary text-base px-8 py-3">
          {isBusy
            ? <><Spinner /> {workflowStatus === 'compiling' ? 'Compiling...' : 'Running...'}</>
            : <>▶ Compile + Run</>
          }
        </button>
      </div>

      {/* ── pipeline ── */}
      <div className="flex justify-center mt-5">
        <div className="pipeline text-xs">
          <span className="pipeline-step source">.aic</span>
          <span className="pipeline-arrow">→</span>
          <span className="pipeline-step compile">aicompiler compile</span>
          <span className="pipeline-arrow">→</span>
          <span className="pipeline-step compile">.aix</span>
          <span className="pipeline-arrow">→</span>
          <span className="pipeline-step run">aivm run</span>
          <span className="pipeline-arrow">→</span>
          <span className="pipeline-step run">step log</span>
        </div>
      </div>
    </div>
  );
}

// ─── Small components ──────────────────────────────────────────────────────────

function Spinner({ small }: { small?: boolean }) {
  const size = small ? 12 : 14;
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
  );
}

function CompileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
  );
}
