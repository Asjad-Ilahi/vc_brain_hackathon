/**
 * ODIN roll-up standee — print-ready, 85×200 cm proportions.
 * Rendered at 3400×8000 px (~101 DPI at full size — correct for large-format
 * viewed from >1 m). Same tokens/primitives as the app + launch video.
 *
 * Layout (top → bottom): brand header · headline · agent pipeline ·
 * proof stats · QR call-to-action · gradient footer (safe for the roll-up
 * mechanism to swallow the bottom ~10 cm).
 */
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { c, font, shadow, brandGradient } from "./theme";

const W = 3400;

/* ------------------------------ small pieces ------------------------------ */

const Pill: React.FC<{ children: React.ReactNode; bg?: string; fg?: string; size?: number }> = ({
  children,
  bg = c.brandfaint,
  fg = c.brand,
  size = 44,
}) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 18,
      background: bg,
      color: fg,
      borderRadius: 9999,
      padding: `${size * 0.5}px ${size * 1.1}px`,
      fontFamily: font.sans,
      fontSize: size,
      fontWeight: 700,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </span>
);

const STEPS = [
  { glyph: "◎", label: "Signals", sub: "GitHub · arXiv · HN · patents · launches" },
  { glyph: "⌗", label: "Screen", sub: "against the fund thesis" },
  { glyph: "◈", label: "3-Axis Score", sub: "founder · market · idea · never blended" },
  { glyph: "▤", label: "Memo", sub: "evidence-backed draft" },
  { glyph: "✓", label: "Verify", sub: "per-claim trust score" },
];

const STATS = [
  { v: "8", l: "sourcing channels" },
  { v: "3", l: "independent scores" },
  { v: "24h", l: "to a decision" },
];

/* --------------------------------- design --------------------------------- */

export const Standee: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: c.canvas, fontFamily: font.sans, overflow: "hidden" }}>
      {/* soft brand orbs, echoing the app/video canvas */}
      <div
        style={{
          position: "absolute",
          left: "-18%",
          top: "-4%",
          width: 2600,
          height: 2600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,69,255,0.10) 0%, rgba(0,69,255,0) 66%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: "-22%",
          top: "30%",
          width: 2900,
          height: 2900,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(95,131,255,0.10) 0%, rgba(95,131,255,0) 68%)",
        }}
      />
      {/* faint dot grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(${c.linestrong} 2.4px, transparent 2.4px)`,
          backgroundSize: "104px 104px",
          opacity: 0.4,
        }}
      />

      {/* ------------------------------ header ------------------------------ */}
      <div style={{ position: "absolute", top: 300, left: 0, width: W, textAlign: "center" }}>
        <Img
          src={staticFile("logo.png")}
          style={{ width: 1240, objectFit: "contain", mixBlendMode: "multiply" }}
        />
        <div style={{ marginTop: 10, fontSize: 76, fontWeight: 600, color: c.muted }}>
          AI Operating System for Autonomous Venture Intelligence
        </div>
        <div style={{ marginTop: 60 }}>
          <Pill size={46}>
            <span style={{ width: 20, height: 20, borderRadius: "50%", background: c.brand, display: "inline-block" }} />
            Maschmeyer Group · AI Venture Capital Challenge
          </Pill>
        </div>
      </div>

      {/* ----------------------------- headline ----------------------------- */}
      <div style={{ position: "absolute", top: 1310, left: 0, width: W, textAlign: "center", padding: "0 220px" }}>
        <div style={{ fontSize: 208, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.02, color: c.ink }}>
          Decide on any founder
          <br />
          in <span style={{ color: c.brand }}>24 hours.</span>
        </div>
        <div style={{ marginTop: 56, fontSize: 74, fontWeight: 500, color: c.muted }}>
          Sourcing · screening · diligence · evidence-backed memos
        </div>
      </div>

      {/* ----------------------------- pipeline ----------------------------- */}
      <div style={{ position: "absolute", top: 2260, left: 0, width: W, padding: "0 480px" }}>
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: c.brand,
            textAlign: "center",
            marginBottom: 90,
          }}
        >
          The agent pipeline
        </div>

        {/* vertical connector */}
        <div style={{ position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: 129,
              top: 90,
              bottom: 90,
              width: 10,
              borderRadius: 999,
              background: `linear-gradient(180deg, ${c.brandwash} 0%, ${c.brand} 50%, ${c.brandwash} 100%)`,
            }}
          />
          {STEPS.map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 90, marginBottom: 74 }}>
              <div
                style={{
                  width: 268,
                  height: 268,
                  borderRadius: 72,
                  background: "#fff",
                  border: `3px solid rgba(0,69,255,0.28)`,
                  boxShadow: shadow.glow,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 108,
                  color: c.brand,
                  flexShrink: 0,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {s.glyph}
              </div>
              <div>
                <div style={{ fontSize: 92, fontWeight: 800, color: c.ink, letterSpacing: "-0.02em" }}>{s.label}</div>
                <div style={{ fontSize: 56, color: c.muted, marginTop: 8 }}>{s.sub}</div>
              </div>
            </div>
          ))}

          {/* the human payoff */}
          <div style={{ display: "flex", alignItems: "center", gap: 90 }}>
            <div
              style={{
                width: 268,
                height: 268,
                borderRadius: "50%",
                background: brandGradient,
                boxShadow: "0 40px 120px rgba(0,69,255,0.4)",
                display: "grid",
                placeItems: "center",
                fontSize: 100,
                color: "#fff",
                flexShrink: 0,
                position: "relative",
                zIndex: 1,
              }}
            >
              ◆
            </div>
            <div>
              <div style={{ fontSize: 92, fontWeight: 800, color: c.ink, letterSpacing: "-0.02em" }}>You decide</div>
              <div style={{ fontSize: 56, color: c.ok, marginTop: 8, fontWeight: 700 }}>
                one human in the loop · the system never deploys capital
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------- stats ------------------------------- */}
      <div
        style={{
          position: "absolute",
          top: 4900,
          left: 0,
          width: W,
          display: "flex",
          justifyContent: "center",
          gap: 70,
          padding: "0 240px",
        }}
      >
        {STATS.map((s) => (
          <div
            key={s.l}
            style={{
              flex: 1,
              background: "#fff",
              border: `1px solid ${c.line}`,
              borderRadius: 64,
              boxShadow: shadow.soft,
              padding: "90px 40px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 190, fontWeight: 800, color: c.brand, lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontSize: 58, fontWeight: 600, color: c.muted, marginTop: 26 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* ----------------------------- QR + CTA ----------------------------- */}
      <div style={{ position: "absolute", top: 5760, left: 0, width: W, padding: "0 340px" }}>
        <div
          style={{
            background: "#fff",
            border: `1px solid ${c.line}`,
            borderRadius: 88,
            boxShadow: shadow.lift,
            padding: "120px 140px",
            display: "flex",
            alignItems: "center",
            gap: 130,
          }}
        >
          <div
            style={{
              padding: 44,
              borderRadius: 56,
              border: `6px solid ${c.brandwash}`,
              background: "#fff",
              flexShrink: 0,
            }}
          >
            <Img src={staticFile("qr-apply.png")} style={{ width: 660, height: 660 }} />
          </div>
          <div>
            <div style={{ fontSize: 118, fontWeight: 800, color: c.ink, letterSpacing: "-0.025em", lineHeight: 1.08 }}>
              Founders: apply in <span style={{ color: c.brand }}>2 minutes.</span>
            </div>
            <div style={{ fontSize: 62, color: c.muted, marginTop: 40, lineHeight: 1.4 }}>
              Company name + deck. No account. A human decision within 24 hours. Promised.
            </div>
            <div style={{ marginTop: 56 }}>
              <Pill size={54} bg={c.okwash} fg={c.ok}>
                vc-brain-eosin.vercel.app/apply
              </Pill>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------ footer ------------------------------ */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: W,
          height: 640,
          background: brandGradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 300px",
          color: "#fff",
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: "-0.02em" }}>ODIN</div>
        <div style={{ fontSize: 54, fontWeight: 600, opacity: 0.92, textAlign: "right", lineHeight: 1.4 }}>
          Hack-Nation · 6th Global AI Hackathon
          <br />
          Maschmeyer Group VC Brain Challenge
        </div>
      </div>
    </AbsoluteFill>
  );
};
