import { useState, useRef, useCallback } from "react";
import Editor from "@monaco-editor/react";

const WORKER_URL = import.meta.env.PUBLIC_WORKER_URL ?? "https://aivm-worker.theweekendprojects.workers.dev";

const EXAMPLES = {
  hello: `module HelloWorld
version 1.0

context:
  A simple hello world demonstration.

tools: [console]

intent sayHello:
  Say hello to the world in a creative and inspiring way.
  Include a short motivational quote about the future of AI
  and intent-driven programming.

  output:
    - a warm greeting with a motivational quote`,

  userService: `module UserService
version 1.0

context:
  A REST API managing users in a PostgreSQL database.

tools: [database, http]

intent getAdultUsers:
  Get all users where age is above 18.
  Return them sorted by name ascending.

  output:
    - array of user objects: id, name, email, age

intent findByEmail:
  Find a single user by their email address.
  Return null if not found.

  input:
    - email: the email address to search for

  output:
    - user object or null`,

  emailNotifier: `module EmailNotifier
version 1.0

context:
  A notification service that sends transactional emails.

tools: [email, templates]

intent sendWelcomeEmail:
  Send a warm welcome email to a newly registered user.
  The email should feel personal, not robotic.
  Include: a greeting, what they can do next, and a support link.

  input:
    - name: the user's first name
    - email: the user's email address

  output:
    - email subject line
    - email body in plain text`,
};

type Tab = "source" | "bytecode" | "output";
type ExampleKey = keyof typeof EXAMPLES;

interface BytecodeData {
  module: string;
  version: string;
  compiledAt: string;
  sourceHash: string;
  intents: Array<{ id: string; name: string; description: string }>;
}

export function LiveDemo() {
  const [source, setSource] = useState(EXAMPLES.hello);
  const [activeTab, setActiveTab] = useState<Tab>("source");
  const [bytecode, setBytecode] = useState<BytecodeData | null>(null);
  const [output, setOutput] = useState("");
  const [isCompiling, setIsCompiling] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<"anthropic" | "bedrock">("anthropic");
  const outputRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: "smooth" });
  };

  const compile = useCallback(async () => {
    setError(null);
    setIsCompiling(true);
    setBytecode(null);
    setOutput("");
    try {
      const res = await fetch(`${WORKER_URL}/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, provider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Compilation failed");
      setBytecode(data);
      setActiveTab("bytecode");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsCompiling(false);
    }
  }, [source, provider]);

  const run = useCallback(async () => {
    if (!bytecode) return;
    setError(null);
    setIsRunning(true);
    setOutput("");
    setActiveTab("output");

    try {
      // stream each intent sequentially
      for (const intent of bytecode.intents) {
        setOutput(prev => prev + `\n▶ Running intent: ${intent.name}\n${"─".repeat(50)}\n`);
        scrollToBottom();

        const res = await fetch(`${WORKER_URL}/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bytecode, intentName: intent.name, provider }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Stream failed");
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") continue;
            try {
              const chunk = JSON.parse(raw);
              if (chunk.type === "text-delta") {
                setOutput(prev => prev + chunk.delta);
                scrollToBottom();
              }
            } catch { /* ignore parse errors */ }
          }
        }
        setOutput(prev => prev + "\n\n");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsRunning(false);
    }
  }, [bytecode, provider]);

  const compileAndRun = useCallback(async () => {
    setError(null);
    setIsCompiling(true);
    setBytecode(null);
    setOutput("");

    let compiled: BytecodeData | null = null;
    try {
      const res = await fetch(`${WORKER_URL}/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, provider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Compilation failed");
      compiled = data;
      setBytecode(data);
    } catch (e: any) {
      setError(e.message);
      setIsCompiling(false);
      return;
    }
    setIsCompiling(false);

    if (!compiled) return;
    setIsRunning(true);
    setActiveTab("output");

    try {
      for (const intent of compiled.intents) {
        setOutput(prev => prev + `▶ ${intent.name}\n${"─".repeat(48)}\n`);

        const res = await fetch(`${WORKER_URL}/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bytecode: compiled, intentName: intent.name, provider }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Stream failed");
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") continue;
            try {
              const chunk = JSON.parse(raw);
              if (chunk.type === "text-delta") {
                setOutput(prev => prev + chunk.delta);
                setTimeout(scrollToBottom, 50);
              }
            } catch { /* ignore */ }
          }
        }
        setOutput(prev => prev + "\n\n");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsRunning(false);
    }
  }, [source, provider]);

  const isBusy = isCompiling || isRunning;

  return (
    <div className="w-full max-w-6xl mx-auto px-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-[var(--color-muted)]">Examples:</span>
          {(Object.keys(EXAMPLES) as ExampleKey[]).map(key => (
            <button
              key={key}
              onClick={() => { setSource(EXAMPLES[key]); setActiveTab("source"); setBytecode(null); setOutput(""); setError(null); }}
              className="badge badge-purple cursor-pointer hover:opacity-80 transition-opacity"
            >
              {key}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-muted)]">Model:</span>
          <select
            value={provider}
            onChange={e => setProvider(e.target.value as any)}
            className="text-xs px-2 py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text)] cursor-pointer"
          >
            <option value="anthropic">Claude (Anthropic)</option>
            <option value="bedrock">Nova Micro (AWS)</option>
          </select>
        </div>
      </div>

      {/* Main editor grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Left — source editor */}
        <div className="editor-pane flex flex-col" style={{ height: "420px" }}>
          <div className="editor-tab-bar">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
            <span className="ml-2 editor-tab active">app.aic</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              defaultLanguage="markdown"
              value={source}
              onChange={v => setSource(v ?? "")}
              theme="vs-dark"
              options={{
                fontSize: 13,
                fontFamily: "JetBrains Mono, Fira Code, monospace",
                minimap: { enabled: false },
                lineNumbers: "on",
                wordWrap: "on",
                scrollBeyondLastLine: false,
                padding: { top: 12, bottom: 12 },
                renderLineHighlight: "line",
                scrollbar: { verticalScrollbarSize: 4 },
              }}
            />
          </div>
        </div>

        {/* Right — bytecode / output tabs */}
        <div className="editor-pane flex flex-col" style={{ height: "420px" }}>
          <div className="editor-tab-bar">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
            <div className="ml-2 flex gap-1">
              {(["bytecode", "output"] as Tab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`editor-tab ${activeTab === tab ? "active" : ""}`}
                >
                  {tab === "bytecode" ? "app.aibc" : "output"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4" ref={outputRef}>
            {activeTab === "bytecode" && (
              <>
                {!bytecode && (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-[var(--color-muted)]">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                    <p className="text-sm">Click <strong className="text-[var(--color-primary-glow)]">Compile</strong> to generate .aibc bytecode</p>
                  </div>
                )}
                {bytecode && (
                  <div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="badge badge-purple">module: {bytecode.module}</span>
                      <span className="badge badge-cyan">{bytecode.intents.length} intent(s)</span>
                      <span className="badge badge-green">hash: {bytecode.sourceHash}</span>
                    </div>
                    <pre className="output-stream text-[var(--color-accent)] text-xs overflow-auto">
                      {JSON.stringify(bytecode, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            )}
            {activeTab === "output" && (
              <>
                {!output && !isRunning && (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-[var(--color-muted)]">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
                    </svg>
                    <p className="text-sm">Click <strong className="text-[var(--color-accent-2)]">Run</strong> to execute intents</p>
                  </div>
                )}
                {(output || isRunning) && (
                  <div className="output-stream">
                    {output}
                    {isRunning && <span className="output-cursor" />}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-mono">
          ✗ {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button onClick={compile} disabled={isBusy} className="btn-ghost">
          {isCompiling ? (
            <><Spinner /> Compiling...</>
          ) : (
            <><CompileIcon /> Compile → .aibc</>
          )}
        </button>
        <button onClick={run} disabled={isBusy || !bytecode} className="btn-ghost">
          {isRunning ? (
            <><Spinner /> Running...</>
          ) : (
            <><RunIcon /> aivm run</>
          )}
        </button>
        <button onClick={compileAndRun} disabled={isBusy} className="btn-primary text-base px-8 py-3">
          {isBusy ? (
            <><Spinner /> {isCompiling ? "Compiling..." : "Running..."}</>
          ) : (
            <>▶ Run it now</>
          )}
        </button>
      </div>

      {/* Pipeline hint */}
      <div className="flex justify-center mt-5">
        <div className="pipeline text-xs">
          <span className="pipeline-step source">.aic</span>
          <span className="pipeline-arrow">→</span>
          <span className="pipeline-step compile">aicompiler compile</span>
          <span className="pipeline-arrow">→</span>
          <span className="pipeline-step compile">.aibc</span>
          <span className="pipeline-arrow">→</span>
          <span className="pipeline-step run">aivm run</span>
          <span className="pipeline-arrow">→</span>
          <span className="pipeline-step run">output</span>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function CompileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}

function RunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
    </svg>
  );
}
