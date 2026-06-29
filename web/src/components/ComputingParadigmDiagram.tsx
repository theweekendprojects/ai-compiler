/**
 * ComputingParadigmDiagram — v2
 *
 * Visual style inspired by:
 * - Tailscale: animated SVG flow lines (stroke-dashoffset)
 * - Stripe: CSS offset-path data packets moving along paths
 * - Linear: dark, dense, real-feeling
 *
 * Left panel:  Von Neumann classical computer
 * Right panel: aiVM — LLM-powered virtual machine
 *
 * Key visual metaphor:
 * - Classical: ONE square data packet, fixed linear path (deterministic)
 * - aiVM: MANY soft orbs lighting up paths (probabilistic/emergent)
 *
 * Pure CSS animations — transform + opacity only (fixing-motion-performance skill)
 * animejs v4 for scroll-triggered stagger reveal (animejs-animation skill)
 */

import { useEffect, useRef, useState } from "react";
import {
  Cpu, Memory, HardDrive, Database, PlugsConnected,
  GitFork, Brain, Lightning, Lock, ArrowRight,
  ArrowsSplit, FlowArrow
} from "@phosphor-icons/react";

// ─── Component data ───────────────────────────────────────────────────────────

const CLASSICAL_NODES = [
  { id: "cpu",       label: "CPU",        Icon: Cpu,              color: "#6366f1", sub: "Executes machine code" },
  { id: "ram",       label: "RAM",         Icon: Memory,           color: "#0891b2", sub: "Program state + stack" },
  { id: "cache",     label: "Cache",       Icon: Lightning,             color: "#0284c7", sub: "Fast recent-access storage" },
  { id: "registers", label: "Registers",   Icon: GitFork,          color: "#7c3aed", sub: "Working variables" },
  { id: "bus",       label: "System Bus",  Icon: PlugsConnected,   color: "#475569", sub: "Connects all components" },
  { id: "disk",      label: "Hard Disk",   Icon: HardDrive,        color: "#059669", sub: "Persistent storage" },
  { id: "rom",       label: "ROM / BIOS",  Icon: Lock,             color: "#b45309", sub: "Read-only firmware" },
];

const AIVM_NODES = [
  { id: "llm",       label: "LLM Engine",      Icon: Brain,          color: "#9d5bff", sub: "Executes intent opcodes" },
  { id: "ctx",       label: "Context Window",   Icon: Memory,         color: "#06b6d4", sub: "Working memory per turn" },
  { id: "aix",       label: ".aix Lock Files",  Icon: Lightning,           color: "#0ea5e9", sub: "Cache — same spec = instant" },
  { id: "state",     label: "Step State",       Icon: ArrowsSplit,    color: "#8b5cf6", sub: "$step_1.output, $input.x" },
  { id: "adapters",  label: "Tool Adapters",    Icon: PlugsConnected, color: "#64748b", sub: "DB, email, APIs, HTTP" },
  { id: "kvdb",      label: "KV + VectorDB",    Icon: Database,       color: "#10b981", sub: "Persistent memory + RAG" },
  { id: "sysprompt", label: "System Prompt",    Icon: Lock,           color: "#f59e0b", sub: "Read-only, loads at boot" },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function ComputingParadigmDiagram() {
  const sectionRef   = useRef<HTMLDivElement>(null);
  const [active, setActive]       = useState(-1);
  const [revealed, setRevealed]   = useState(false);

  // Sequential pulse
  useEffect(() => {
    const iv = setInterval(() => {
      setActive(i => (i + 1) % CLASSICAL_NODES.length);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // Scroll reveal via animejs
  useEffect(() => {
    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || revealed) return;
        setRevealed(true);
        const { animate, stagger, createTimeline } = await import("animejs");
        const isMobile = window.innerWidth < 700;

        const tl = createTimeline({ easing: "spring(1, 80, 10, 0)" });
        tl.add(".pdg-header", { opacity: [0, 1], translateY: [-20, 0], duration: 600 });
        tl.add(".pdg-left",   { opacity: [0, 1], translateX: [isMobile ? -20 : -50, 0], duration: 700 }, "-=400");
        tl.add(".pdg-divider",{ opacity: [0, 1], scaleY: [0, 1], duration: 500 }, "-=500");
        tl.add(".pdg-right",  { opacity: [0, 1], translateX: [isMobile ? 20 : 50, 0], duration: 700 }, "-=600");
      },
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [revealed]);

  return (
    <div ref={sectionRef} style={{ width: "100%", maxWidth: "76rem", margin: "0 auto" }}>

      {/* ── Header ── */}
      <div className="pdg-header" style={{ textAlign: "center", marginBottom: "3rem", opacity: 0 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: "0.4rem",
          padding: "0.3rem 0.875rem", borderRadius: "9999px",
          fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
          border: "1px solid rgba(124,58,237,0.4)", background: "rgba(124,58,237,0.08)",
          color: "#9d5bff", marginBottom: "1.25rem",
        }}>
          <span style={{ width: "0.4rem", height: "0.4rem", borderRadius: "50%", background: "#9d5bff", display: "inline-block", animation: "pulse 2s infinite" }} />
          A new virtual machine paradigm
        </span>

        <h2 style={{
          fontSize: "clamp(1.75rem,4vw,3rem)", fontWeight: 900,
          letterSpacing: "-0.03em", margin: "0 0 1rem", lineHeight: 1.05,
          textWrap: "balance" as any,
        }}>
          Just as the <span style={{ fontFamily: "var(--font-mono)", color: "#94a3b8" }}>JVM</span> runs Java bytecode using a CPU,<br />
          <span style={{
            background: "linear-gradient(135deg,#9d5bff 0%,#06b6d4 50%,#10b981 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>aiVM runs .aix opcodes using an LLM.</span>
        </h2>

        <p style={{ color: "#7878a0", fontSize: "1rem", maxWidth: "44rem", margin: "0 auto", lineHeight: 1.75, textWrap: "balance" as any }}>
          Every component of Von Neumann architecture maps exactly to an aiVM component.
          The LLM isn't the CPU — it's the <strong style={{ color: "#c4b5fd" }}>execution engine of the VM</strong>.
          Everything else follows from that.
        </p>
      </div>

      {/* ── Main diagram ── */}
      <div className="pdg-main-grid" style={{ display: "grid", alignItems: "start" }}>

        {/* LEFT — Classical */}
        <PanelCard
          className="pdg-left"
          era="1950s — 2025"
          title="Von Neumann Computer"
          subtitle="Silicon CPU executes machine code instructions sequentially"
          accentColor="#6366f1"
          dimmed
          nodes={CLASSICAL_NODES}
          active={active}
          isClassical
        />

        {/* CENTER — Animated divider */}
        <div className="pdg-divider" style={{
          width: "2px", alignSelf: "stretch", marginTop: "0",
          background: "linear-gradient(to bottom, transparent, rgba(124,58,237,0.4) 20%, rgba(6,182,212,0.4) 50%, rgba(16,185,129,0.4) 80%, transparent)",
          opacity: 0, transformOrigin: "top",
          position: "relative", minHeight: "600px",
        }}>
          {/* Flowing dot on divider */}
          <div style={{
            position: "absolute", width: "8px", height: "8px", borderRadius: "50%",
            background: "linear-gradient(135deg,#9d5bff,#06b6d4)",
            left: "-3px",
            animation: "dividerDot 3s ease-in-out infinite",
            boxShadow: "0 0 8px #9d5bff",
          }} />
        </div>

        {/* RIGHT — aiVM */}
        <PanelCard
          className="pdg-right"
          era="2026 →"
          title="aiVM Computer"
          subtitle="LLM executes intent opcodes — each step is a direct model inference"
          accentColor="#9d5bff"
          dimmed={false}
          nodes={AIVM_NODES}
          active={active}
          isClassical={false}
        />

      </div>

      {/* ── Bottom equation ── */}
      <div style={{
        marginTop: "2rem",
        padding: "1.25rem 1.5rem",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "1rem",
        display: "flex", flexWrap: "wrap", gap: "0.5rem 1.5rem",
        justifyContent: "center", alignItems: "center",
      }}>
        {CLASSICAL_NODES.map((cn, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: "0.375rem",
            fontSize: "0.75rem", fontFamily: "var(--font-mono)",
            transition: "opacity 0.3s",
            opacity: active === i ? 1 : 0.35,
          }}>
            <span style={{ color: active === i ? cn.color : "#404060", fontWeight: 700 }}>{cn.label}</span>
            <span style={{ color: "#303050" }}>≡</span>
            <span style={{ color: active === i ? AIVM_NODES[i].color : "#404060", fontWeight: 700 }}>{AIVM_NODES[i].label}</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes dividerDot {
          0%   { top: 5%;  opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 95%; opacity: 0; }
        }
        @keyframes nodeGlow {
          0%,100% { box-shadow: 0 0 0 0 currentColor; }
          50%      { box-shadow: 0 0 16px 2px currentColor; }
        }

        /* ── Responsive grid ── */
        .pdg-main-grid {
          grid-template-columns: 1fr 2px 1fr;
          gap: 0 2rem;
        }

        @media (max-width: 700px) {
          .pdg-main-grid {
            grid-template-columns: 1fr !important;
            gap: 1rem 0 !important;
          }
          .pdg-divider {
            display: none !important;
          }
          .pdg-left,
          .pdg-right {
            /* Reset translateX animations on mobile */
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Panel card ───────────────────────────────────────────────────────────────

function PanelCard({
  className, era, title, subtitle, accentColor, dimmed, nodes, active, isClassical,
}: {
  className: string; era: string; title: string; subtitle: string;
  accentColor: string; dimmed: boolean; nodes: typeof CLASSICAL_NODES;
  active: number; isClassical: boolean;
}) {
  return (
    <div
      className={className}
      style={{
        background: dimmed ? "rgba(255,255,255,0.015)" : "rgba(124,58,237,0.04)",
        border: `1px solid ${dimmed ? "rgba(255,255,255,0.07)" : "rgba(124,58,237,0.22)"}`,
        borderRadius: "1.25rem",
        padding: "1.5rem",
        opacity: 0,
      }}
    >
      {/* Panel header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <div style={{
          width: "2.5rem", height: "2.5rem", borderRadius: "0.75rem", flexShrink: 0,
          background: dimmed ? "rgba(255,255,255,0.05)" : `rgba(124,58,237,0.15)`,
          border: `1px solid ${dimmed ? "rgba(255,255,255,0.08)" : "rgba(124,58,237,0.3)"}`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem",
        }}>
          {isClassical ? "🖥️" : "🤖"}
        </div>
        <div>
          <div style={{
            fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase",
            color: dimmed ? "#7878a0" : accentColor, marginBottom: "0.2rem",
          }}>{era}</div>
          <div style={{ fontSize: "1rem", fontWeight: 800, color: dimmed ? "#c0c0d8" : "#f0f0f8" }}>{title}</div>
          <div style={{ fontSize: "0.72rem", color: "#5058a0", marginTop: "0.2rem", lineHeight: 1.4 }}>{subtitle}</div>
        </div>
      </div>

      {/* Nodes */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {nodes.map((node, i) => {
          const isActive = i === active;
          const Icon = node.Icon;
          return (
            <NodeRow
              key={node.id}
              node={node}
              isActive={isActive}
              isClassical={isClassical}
              index={i}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Node row ─────────────────────────────────────────────────────────────────

function NodeRow({ node, isActive, isClassical, index }: {
  node: typeof CLASSICAL_NODES[0]; isActive: boolean; isClassical: boolean; index: number;
}) {
  const Icon = node.Icon;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.75rem",
      padding: "0.6rem 0.875rem",
      borderRadius: "0.875rem",
      border: `1px solid ${isActive ? node.color + "55" : "rgba(255,255,255,0.04)"}`,
      background: isActive ? node.color + "15" : "transparent",
      transition: "all 0.45s cubic-bezier(0.32,0.72,0,1)",
      position: "relative", overflow: "hidden",
    }}>

      {/* Animated scan line when active */}
      {isActive && (
        <div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(90deg, transparent 0%, ${node.color}15 50%, transparent 100%)`,
          animation: "scanLine 1.2s ease-in-out infinite",
          pointerEvents: "none",
        }} />
      )}

      {/* Icon box */}
      <div style={{
        width: "2.25rem", height: "2.25rem", flexShrink: 0,
        borderRadius: "0.625rem",
        background: isActive ? node.color + "25" : "rgba(255,255,255,0.04)",
        border: `1px solid ${isActive ? node.color + "50" : "rgba(255,255,255,0.07)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.45s cubic-bezier(0.32,0.72,0,1)",
        boxShadow: isActive ? `0 0 20px ${node.color}45, inset 0 1px 1px rgba(255,255,255,0.1)` : "inset 0 1px 1px rgba(255,255,255,0.04)",
        color: isActive ? node.color : "#404070",
      }}>
        <Icon size={16} weight={isActive ? "fill" : "regular"} />
      </div>

      {/* Text */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: "0.83rem", fontWeight: 700,
          fontFamily: isActive ? "var(--font-mono)" : "inherit",
          color: isActive ? "#f0f0f8" : "#8080a0",
          transition: "all 0.3s",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {node.label}
        </div>
        <div style={{
          fontSize: "0.7rem",
          color: isActive ? "#7070a0" : "#303060",
          transition: "color 0.3s",
          lineHeight: 1.4,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {node.sub}
        </div>
      </div>

      {/* Right side — classical gets a square packet, aiVM gets a glow orb */}
      {isActive && (
        isClassical ? (
          <div style={{
            width: "0.5rem", height: "0.5rem", borderRadius: "2px", flexShrink: 0,
            background: node.color,
            boxShadow: `0 0 6px ${node.color}`,
            animation: "blink 0.6s step-end infinite",
          }} />
        ) : (
          <div style={{
            width: "0.6rem", height: "0.6rem", borderRadius: "50%", flexShrink: 0,
            background: node.color,
            boxShadow: `0 0 12px ${node.color}, 0 0 24px ${node.color}60`,
            animation: "pulse 0.9s ease-in-out infinite",
          }} />
        )
      )}

      <style>{`
        @keyframes scanLine {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes blink {
          0%,100%{opacity:1}50%{opacity:0}
        }
      `}</style>
    </div>
  );
}
