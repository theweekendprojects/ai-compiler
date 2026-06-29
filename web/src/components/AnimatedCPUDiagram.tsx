/**
 * AnimatedCPUDiagram
 *
 * Two-column animated diagram:
 *   Left:  Classical Von Neumann computer
 *   Right: LLM-driven aiCompiler computer
 *
 * Each component pulses in sequence showing data flow.
 * Uses CSS animations only — no runtime dependencies.
 */

import { useEffect, useState, useRef } from "react";

// ─── Data ─────────────────────────────────────────────────────────────────────

const CLASSICAL = [
  { id: "cpu",       icon: "🧠", label: "CPU",        sub: "Silicon — executes machine code",     color: "#7c3aed" },
  { id: "ram",       icon: "⚡", label: "RAM",         sub: "Working memory — holds program state", color: "#0891b2" },
  { id: "cache",     icon: "⚡", label: "Cache",       sub: "Fast recent-access storage",           color: "#0891b2" },
  { id: "registers", icon: "📌", label: "Registers",   sub: "CPU working variables (eax, rbx…)",   color: "#7c3aed" },
  { id: "bus",       icon: "🔌", label: "System Bus",  sub: "Connects CPU to memory + I/O",         color: "#6b7280" },
  { id: "hdd",       icon: "💾", label: "Hard Disk",   sub: "Persistent storage — files + DB",      color: "#059669" },
  { id: "rom",       icon: "📀", label: "ROM / BIOS",  sub: "Read-only firmware, loads on boot",    color: "#b45309" },
];

const AICOMPILER = [
  { id: "llm",       icon: "🧠", label: "LLM",               sub: "The CPU — executes intent as opcodes",    color: "#9d5bff" },
  { id: "ctx",       icon: "⚡", label: "Context Window",     sub: "RAM — working memory per execution",      color: "#06b6d4" },
  { id: "aix",       icon: "🗄️", label: ".aix Lock Files",    sub: "Cache — same spec = no recompile",        color: "#06b6d4" },
  { id: "state",     icon: "📌", label: "Step State",         sub: "Registers — $step_1.output, $input.x",   color: "#9d5bff" },
  { id: "adapters",  icon: "🔌", label: "Tool Adapters",      sub: "Bus — DB, email, APIs, HTTP",             color: "#64748b" },
  { id: "kvdb",      icon: "💾", label: "KV Store + VectorDB",sub: "Hard Disk — persistent memory + RAG",    color: "#10b981" },
  { id: "sysprompt", icon: "📀", label: "System Prompt",      sub: "ROM — read-only, loads before execution", color: "#d97706" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function AnimatedCPUDiagram() {
  const [activeIdx, setActiveIdx] = useState(-1);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Start animation when section scrolls into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  // Pulse through rows sequentially
  useEffect(() => {
    if (!started) return;
    let i = 0;
    const interval = setInterval(() => {
      setActiveIdx(i % CLASSICAL.length);
      i++;
    }, 900);
    return () => clearInterval(interval);
  }, [started]);

  return (
    <div ref={ref} style={{ width: "100%", maxWidth: "72rem", margin: "0 auto" }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: "0.4rem",
          padding: "0.3rem 0.875rem", borderRadius: "9999px",
          fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase",
          border: "1px solid rgba(124,58,237,0.35)", background: "rgba(124,58,237,0.1)", color: "#9d5bff",
          marginBottom: "1rem",
        }}>
          <span style={{ width: "0.4rem", height: "0.4rem", borderRadius: "50%", background: "#9d5bff", display: "inline-block" }} />
          A new computing paradigm
        </span>
        <h2 style={{
          fontSize: "clamp(1.75rem,4vw,2.75rem)", fontWeight: 900,
          letterSpacing: "-0.03em", margin: "0 0 0.75rem", textWrap: "balance" as any,
          lineHeight: 1.1,
        }}>
          Von Neumann → <span style={{
            background: "linear-gradient(135deg,#9d5bff,#06b6d4,#10b981)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>LLM Computer</span>
        </h2>
        <p style={{ color: "#7878a0", fontSize: "0.95rem", margin: 0, maxWidth: "36rem", marginInline: "auto", textWrap: "balance" as any }}>
          Every component of a classical computer has an exact analog in the aiCompiler architecture.
          This is not a coincidence. This is a new computing paradigm.
        </p>
      </div>

      {/* Two-column grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
        gap: "1.5rem",
      }}>
        {/* Classical column */}
        <Column
          title="Classical Computer"
          subtitle="Silicon-based Von Neumann architecture"
          items={CLASSICAL}
          activeIdx={activeIdx}
          accent="#7c3aed"
          dim
        />
        {/* aiCompiler column */}
        <Column
          title="aiCompiler Computer"
          subtitle="LLM-based intent execution architecture"
          items={AICOMPILER}
          activeIdx={activeIdx}
          accent="#9d5bff"
          dim={false}
        />
      </div>

      {/* Bottom equation */}
      <div style={{
        marginTop: "2.5rem", textAlign: "center",
        padding: "1.25rem 1.5rem",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "1rem",
      }}>
        <p style={{ margin: 0, color: "#7878a0", fontSize: "0.85rem", lineHeight: 2 }}>
          <span style={{ fontFamily: "var(--font-mono)", color: "#9d5bff" }}>LLM</span> is the CPU &nbsp;·&nbsp;
          <span style={{ fontFamily: "var(--font-mono)", color: "#06b6d4" }}>Context Window</span> is RAM &nbsp;·&nbsp;
          <span style={{ fontFamily: "var(--font-mono)", color: "#06b6d4" }}>.aix lock files</span> are Cache &nbsp;·&nbsp;
          <span style={{ fontFamily: "var(--font-mono)", color: "#9d5bff" }}>Step state</span> are Registers<br />
          <span style={{ fontFamily: "var(--font-mono)", color: "#64748b" }}>Tool adapters</span> are the Bus &nbsp;·&nbsp;
          <span style={{ fontFamily: "var(--font-mono)", color: "#10b981" }}>KV + VectorDB</span> is the Hard Disk &nbsp;·&nbsp;
          <span style={{ fontFamily: "var(--font-mono)", color: "#d97706" }}>System prompt</span> is ROM
        </p>
      </div>

    </div>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────

function Column({
  title, subtitle, items, activeIdx, accent, dim,
}: {
  title: string; subtitle: string;
  items: typeof CLASSICAL; activeIdx: number;
  accent: string; dim: boolean;
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.025)",
      border: `1px solid ${dim ? "rgba(255,255,255,0.06)" : "rgba(124,58,237,0.25)"}`,
      borderRadius: "1.25rem",
      padding: "1.5rem",
      opacity: dim ? 0.75 : 1,
      transition: "opacity 0.3s",
    }}>
      {/* Header */}
      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "0.375rem",
          padding: "0.2rem 0.6rem", borderRadius: "9999px",
          fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
          background: dim ? "rgba(255,255,255,0.05)" : `rgba(124,58,237,0.12)`,
          color: dim ? "#7878a0" : accent,
          border: `1px solid ${dim ? "rgba(255,255,255,0.08)" : `rgba(124,58,237,0.3)`}`,
          marginBottom: "0.5rem",
        }}>
          {!dim && <span style={{ width: "0.35rem", height: "0.35rem", borderRadius: "50%", background: accent, display: "inline-block" }} />}
          {dim ? "Classical" : "aiCompiler"}
        </div>
        <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: "0 0 0.25rem", color: dim ? "#b0b0c8" : "#f0f0f8" }}>{title}</h3>
        <p style={{ fontSize: "0.75rem", color: "#7878a0", margin: 0 }}>{subtitle}</p>
      </div>

      {/* Rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {items.map((item, i) => {
          const isActive = i === activeIdx;
          return (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.625rem 0.875rem",
                borderRadius: "0.75rem",
                border: `1px solid ${isActive ? item.color + "50" : "rgba(255,255,255,0.04)"}`,
                background: isActive ? item.color + "14" : "transparent",
                transition: "all 0.4s cubic-bezier(0.32,0.72,0,1)",
                transform: isActive ? "translateX(4px)" : "translateX(0)",
              }}
            >
              {/* Icon */}
              <div style={{
                width: "2rem", height: "2rem", borderRadius: "0.5rem", flexShrink: 0,
                background: isActive ? item.color + "25" : "rgba(255,255,255,0.04)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1rem",
                border: `1px solid ${isActive ? item.color + "40" : "rgba(255,255,255,0.06)"}`,
                transition: "all 0.4s cubic-bezier(0.32,0.72,0,1)",
                boxShadow: isActive ? `0 0 12px ${item.color}30` : "none",
              }}>
                {item.icon}
              </div>

              {/* Text */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: "0.85rem", fontWeight: 700,
                  color: isActive ? "#f0f0f8" : "#9090b8",
                  fontFamily: isActive ? "var(--font-mono)" : "inherit",
                  transition: "color 0.3s",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {item.label}
                </div>
                <div style={{
                  fontSize: "0.72rem", color: isActive ? "#9090b8" : "#505070",
                  marginTop: "0.1rem", lineHeight: 1.4,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  transition: "color 0.3s",
                }}>
                  {item.sub}
                </div>
              </div>

              {/* Active pulse dot */}
              {isActive && (
                <div style={{
                  width: "0.5rem", height: "0.5rem", borderRadius: "50%",
                  background: item.color, flexShrink: 0,
                  animation: "pulse-dot 0.8s ease-in-out infinite",
                  boxShadow: `0 0 6px ${item.color}`,
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
