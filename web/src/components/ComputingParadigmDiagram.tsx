/**
 * ComputingParadigmDiagram
 *
 * Animated side-by-side comparison:
 *   Left:  Von Neumann classical computer
 *   Right: aiCompiler LLM computer
 *
 * Uses animejs v4 per animejs-animation skill:
 * - anime.timeline() with spring easing for orchestration
 * - anime.stagger() for organic row reveals
 * - IntersectionObserver trigger (scroll-experience skill)
 * - transform + opacity only (fixing-motion-performance skill)
 * - GPU-safe: will-change on animated elements only
 *
 * Draws an animated SVG connector line between matching rows
 * showing the Von Neumann → LLM mapping.
 */

import { useEffect, useRef, useState } from "react";

const ROWS = [
  {
    icon: "🧠",
    classical: { label: "CPU",          sub: "Silicon — executes machine code",          color: "#7c3aed" },
    llm:       { label: "LLM",           sub: "Executes intent as opcodes",               color: "#9d5bff" },
  },
  {
    icon: "⚡",
    classical: { label: "RAM",           sub: "Working memory — holds program state",     color: "#0891b2" },
    llm:       { label: "Context Window",sub: "Working memory per execution turn",        color: "#06b6d4" },
  },
  {
    icon: "🗄️",
    classical: { label: "Cache",         sub: "Fast recent-access storage",               color: "#0284c7" },
    llm:       { label: ".aix Lock Files",sub:"Same spec = instant, no recompile",        color: "#0ea5e9" },
  },
  {
    icon: "📌",
    classical: { label: "Registers",     sub: "CPU working vars (eax, rbx…)",            color: "#6d28d9" },
    llm:       { label: "Step State",    sub: "$step_1.output, $input.orderId",           color: "#8b5cf6" },
  },
  {
    icon: "🔌",
    classical: { label: "System Bus",   sub: "Connects CPU to memory + I/O",             color: "#475569" },
    llm:       { label: "Tool Adapters",sub: "DB, email, APIs, HTTP",                    color: "#64748b" },
  },
  {
    icon: "💾",
    classical: { label: "Hard Disk",    sub: "Persistent storage — files + DB",          color: "#059669" },
    llm:       { label: "KV + VectorDB",sub: "Persistent memory + RAG context",          color: "#10b981" },
  },
  {
    icon: "📀",
    classical: { label: "ROM / BIOS",   sub: "Read-only firmware, loads on boot",        color: "#b45309" },
    llm:       { label: "System Prompt",sub: "Read-only, loads before every execution",  color: "#f59e0b" },
  },
];

export function ComputingParadigmDiagram() {
  const sectionRef  = useRef<HTMLDivElement>(null);
  const rowRefs     = useRef<(HTMLDivElement | null)[]>([]);
  const lineRefs    = useRef<(SVGPathElement | null)[]>([]);
  const [active, setActive] = useState(-1);
  const animatedRef = useRef(false);

  // ── Scroll-triggered entry animation (scroll-experience skill) ──────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || animatedRef.current) return;
        animatedRef.current = true;

        const { animate, stagger, createTimeline } = await import("animejs");

        // Staggered row reveal — stagger per animejs-animation skill
        const tl = createTimeline({ easing: "spring(1, 80, 10, 0)" });

        // Left column rows
        tl.add(".paradigm-row-left", {
          translateX: [-40, 0],
          opacity:    [0, 1],
          duration:   700,
          delay:      stagger(80),
        });

        // Right column rows — overlapping with left
        tl.add(".paradigm-row-right", {
          translateX: [40, 0],
          opacity:    [0, 1],
          duration:   700,
          delay:      stagger(80),
        }, "-=650");

        // SVG connector lines fade in after rows
        tl.add(".paradigm-connector", {
          opacity: [0, 0.35],
          duration: 400,
          delay:    stagger(80),
          easing:   "easeOutQuad",
        }, "-=400");
      },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  // ── Sequential pulse loop ───────────────────────────────────────────────────
  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => {
      setActive(i % ROWS.length);
      i++;
    }, 1100);
    return () => clearInterval(iv);
  }, []);

  // ── Set initial hidden state via CSS class (not JS useEffect) ─────────────
  // Rows start hidden, anime.js reveals them on IntersectionObserver trigger

  return (
    <div ref={sectionRef} style={{ width: "100%", maxWidth: "72rem", margin: "0 auto" }}>

      {/* ── Section header ── */}
      <div style={{ textAlign: "center", marginBottom: "3rem" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: "0.4rem",
          padding: "0.3rem 0.875rem", borderRadius: "9999px",
          fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.18em",
          textTransform: "uppercase",
          border: "1px solid rgba(124,58,237,0.4)",
          background: "rgba(124,58,237,0.1)", color: "#9d5bff",
          marginBottom: "1.25rem",
        }}>
          <span style={{ width: "0.4rem", height: "0.4rem", borderRadius: "50%", background: "#9d5bff", display: "inline-block", animation: "pulse 2s infinite" }} />
          A new computing paradigm
        </span>

        <h2 style={{
          fontSize: "clamp(1.75rem,4vw,3rem)", fontWeight: 900,
          letterSpacing: "-0.03em", margin: "0 0 1rem",
          lineHeight: 1.05, textWrap: "balance" as any,
        }}>
          I'm not building a tool.<br />
          <span style={{
            background: "linear-gradient(135deg,#9d5bff 0%,#06b6d4 50%,#10b981 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>I'm inventing a new type of computer.</span>
        </h2>

        <p style={{
          color: "#7878a0", fontSize: "1rem", margin: "0 auto",
          maxWidth: "42rem", lineHeight: 1.75, textWrap: "balance" as any,
        }}>
          Every component of the Von Neumann architecture has an exact analog in aiCompiler.
          This is not a coincidence — it is a complete, coherent computing paradigm.
          The LLM is the CPU. Everything else follows.
        </p>
      </div>

      {/* ── Main diagram ── */}
      <div style={{ position: "relative" }}>

        {/* SVG connectors layer — sits between the two columns */}
        <svg
          aria-hidden="true"
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            pointerEvents: "none", zIndex: 1, overflow: "visible",
            display: "none", // hidden on mobile, shown via CSS below
          }}
          className="paradigm-svg"
        >
          {ROWS.map((row, i) => (
            <path
              key={i}
              ref={el => { lineRefs.current[i] = el; }}
              className="paradigm-connector"
              d={`M 0 ${44 + i * 64} Q 60 ${44 + i * 64} 120 ${44 + i * 64}`}
              stroke={row.llm.color}
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          ))}
        </svg>

        {/* Three-column grid: left | spacer | right */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 60px 1fr",
          gap: "0",
          alignItems: "start",
        }} className="paradigm-grid">

          {/* ── LEFT: Classical ── */}
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "1.25rem",
            padding: "1.5rem",
          }}>
            <div style={{ marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <div style={{ width: "2rem", height: "2rem", borderRadius: "0.5rem", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>🖥️</div>
              <div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7878a0" }}>1950s — 2025</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#b0b0c8" }}>Classical Computer</div>
              </div>
            </div>
            {ROWS.map((row, i) => (
              <div
                key={i}
                ref={el => { rowRefs.current[i] = el; }}
                className="paradigm-row-left"
                style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  padding: "0.625rem 0.75rem",
                  borderRadius: "0.75rem",
                  marginBottom: i < ROWS.length - 1 ? "0.375rem" : 0,
                  border: `1px solid ${active === i ? row.classical.color + "45" : "rgba(255,255,255,0.04)"}`,
                  background: active === i ? row.classical.color + "12" : "transparent",
                  transition: "all 0.5s cubic-bezier(0.32,0.72,0,1)",
                  willChange: "transform, opacity",
                }}
              >
                <div style={{
                  width: "2rem", height: "2rem", flexShrink: 0, borderRadius: "0.5rem",
                  background: active === i ? row.classical.color + "20" : "rgba(255,255,255,0.04)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.9rem",
                  border: `1px solid ${active === i ? row.classical.color + "35" : "rgba(255,255,255,0.06)"}`,
                  transition: "all 0.5s cubic-bezier(0.32,0.72,0,1)",
                  boxShadow: active === i ? `0 0 14px ${row.classical.color}30` : "none",
                }}>
                  {row.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: "0.83rem", fontWeight: 700,
                    color: active === i ? "#d0d0e8" : "#7878a0",
                    fontFamily: active === i ? "var(--font-mono)" : "inherit",
                    transition: "color 0.4s",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{row.classical.label}</div>
                  <div style={{
                    fontSize: "0.7rem", color: active === i ? "#6060a0" : "#404060",
                    transition: "color 0.4s", lineHeight: 1.4,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{row.classical.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── MIDDLE: spacer + arrow icons ── */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "4.5rem", gap: "0" }}>
            {ROWS.map((row, i) => (
              <div key={i} style={{
                height: "3.875rem", display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: i < ROWS.length - 1 ? "0.375rem" : 0,
              }}>
                <div style={{
                  fontSize: "0.75rem", color: active === i ? row.llm.color : "rgba(255,255,255,0.08)",
                  transition: "color 0.4s",
                  fontWeight: 700,
                }}>→</div>
              </div>
            ))}
          </div>

          {/* ── RIGHT: aiCompiler ── */}
          <div style={{
            background: "rgba(124,58,237,0.04)",
            border: "1px solid rgba(124,58,237,0.2)",
            borderRadius: "1.25rem",
            padding: "1.5rem",
          }}>
            <div style={{ marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <div style={{ width: "2rem", height: "2rem", borderRadius: "0.5rem", background: "rgba(124,58,237,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>🤖</div>
              <div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9d5bff" }}>2026 →</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#f0f0f8" }}>aiCompiler Computer</div>
              </div>
            </div>
            {ROWS.map((row, i) => (
              <div
                key={i}
                className="paradigm-row-right"
                style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  padding: "0.625rem 0.75rem",
                  borderRadius: "0.75rem",
                  marginBottom: i < ROWS.length - 1 ? "0.375rem" : 0,
                  border: `1px solid ${active === i ? row.llm.color + "55" : "rgba(255,255,255,0.05)"}`,
                  background: active === i ? row.llm.color + "18" : "transparent",
                  transition: "all 0.5s cubic-bezier(0.32,0.72,0,1)",
                  willChange: "transform, opacity",
                }}
              >
                <div style={{
                  width: "2rem", height: "2rem", flexShrink: 0, borderRadius: "0.5rem",
                  background: active === i ? row.llm.color + "25" : "rgba(255,255,255,0.04)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.9rem",
                  border: `1px solid ${active === i ? row.llm.color + "45" : "rgba(255,255,255,0.06)"}`,
                  transition: "all 0.5s cubic-bezier(0.32,0.72,0,1)",
                  boxShadow: active === i ? `0 0 16px ${row.llm.color}40` : "none",
                }}>
                  {row.icon}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: "0.83rem", fontWeight: 700,
                    color: active === i ? "#f0f0f8" : "#9090b8",
                    fontFamily: active === i ? "var(--font-mono)" : "inherit",
                    transition: "color 0.4s",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{row.llm.label}</div>
                  <div style={{
                    fontSize: "0.7rem", color: active === i ? "#9090b8" : "#404060",
                    transition: "color 0.4s", lineHeight: 1.4,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{row.llm.sub}</div>
                </div>
                {active === i && (
                  <div style={{
                    width: "0.45rem", height: "0.45rem", borderRadius: "50%", flexShrink: 0,
                    background: row.llm.color, boxShadow: `0 0 8px ${row.llm.color}`,
                    animation: "pulse-dot 0.9s ease-in-out infinite",
                  }} />
                )}
              </div>
            ))}
          </div>

        </div>{/* end grid */}

        {/* Bottom equation bar */}
        <div style={{
          marginTop: "1.5rem",
          padding: "1rem 1.5rem",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "0.875rem",
          textAlign: "center",
        }}>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "#5050a0", lineHeight: 2 }}>
            {ROWS.map((row, i) => (
              <span key={i}>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  color: active === i ? row.llm.color : "#5050a0",
                  transition: "color 0.4s",
                  fontWeight: active === i ? 700 : 400,
                }}>
                  {row.classical.label}
                </span>
                <span style={{ color: "rgba(255,255,255,0.1)" }}> = </span>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  color: active === i ? row.llm.color : "#5050a0",
                  transition: "color 0.4s",
                  fontWeight: active === i ? 700 : 400,
                }}>
                  {row.llm.label}
                </span>
                {i < ROWS.length - 1 && <span style={{ color: "rgba(255,255,255,0.08)", margin: "0 0.5rem" }}>·</span>}
              </span>
            ))}
          </p>
        </div>

      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.7); }
        }
        /* Initial hidden state — anime.js reveals on scroll */
        .paradigm-row-left,
        .paradigm-row-right {
          opacity: 0;
          will-change: transform, opacity;
        }
        .paradigm-connector {
          opacity: 0;
        }
        @media (max-width: 640px) {
          .paradigm-grid {
            grid-template-columns: 1fr !important;
          }
          .paradigm-grid > *:nth-child(2) {
            display: none !important;
          }
        }
        @media (min-width: 768px) {
          .paradigm-svg {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
