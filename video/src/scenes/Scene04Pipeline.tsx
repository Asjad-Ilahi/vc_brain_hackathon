/**
 * SCENE 4 · 0:21–0:31 — the autonomous agent pipeline.
 * Five nodes light up in sequence; energy packets flow along glowing connectors
 * between them. The final node is deliberately human ("one human in the loop
 * for oversight, not execution") — the product's core promise.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Background } from "../components/Background";
import { Eyebrow, Title, Pill } from "../components/Primitives";
import { c, font, shadow } from "../theme";
import { enter, revealUp, easeOut, loop } from "../utils/anim";

const NODES = [
  { label: "Signals", sub: "GitHub · arXiv · HN · patents", glyph: "◎" },
  { label: "Screen", sub: "against your thesis", glyph: "⌗" },
  { label: "3-Axis Score", sub: "founder · market · idea", glyph: "◈" },
  { label: "Memo", sub: "evidence-backed draft", glyph: "▤" },
  { label: "Verify", sub: "per-claim trust score", glyph: "✓" },
];

/** When each node "activates" (frames). */
const ACTIVATE = [18, 52, 86, 120, 154];

export const Scene04Pipeline: React.FC = () => {
  const frame = useCurrentFrame();

  const N = NODES.length;
  const trackW = 1500;
  const gap = trackW / (N - 1);
  const startX = (1920 - trackW) / 2;
  const y = 560;

  return (
    <AbsoluteFill>
      <Background intensity={0.85} panY={-8} />

      {/* Heading */}
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 150 }}>
        <div style={revealUp(frame, 4)}>
          <Eyebrow>The agent pipeline</Eyebrow>
        </div>
        <div style={{ ...revealUp(frame, 12), marginTop: 14 }}>
          <Title size={72}>Signal in. Conviction out.</Title>
        </div>
      </AbsoluteFill>

      {/* ---- connectors (drawn behind the nodes) ---- */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="wire" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={c.brand} stopOpacity="0.15" />
            <stop offset="50%" stopColor={c.brand} stopOpacity="0.85" />
            <stop offset="100%" stopColor={c.brand} stopOpacity="0.15" />
          </linearGradient>
          <filter id="wireGlow" x="-50%" y="-300%" width="200%" height="700%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {NODES.slice(0, -1).map((_, i) => {
          const x1 = startX + gap * i + 96;
          const x2 = startX + gap * (i + 1) - 96;
          // Wire draws on right before the next node activates.
          const draw = interpolate(frame, [ACTIVATE[i] + 6, ACTIVATE[i + 1]], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: easeOut,
          });
          const len = x2 - x1;
          return (
            <g key={i}>
              {/* base rail */}
              <line x1={x1} y1={y} x2={x2} y2={y} stroke={c.linestrong} strokeWidth={2} strokeLinecap="round" />
              {/* energised rail */}
              <line
                x1={x1}
                y1={y}
                x2={x1 + len * draw}
                y2={y}
                stroke="url(#wire)"
                strokeWidth={3.5}
                strokeLinecap="round"
                filter="url(#wireGlow)"
              />
              {/* flowing packets — only once this leg is live */}
              {draw > 0.98
                ? [0, 0.33, 0.66].map((off, k) => {
                    const t = (loop(frame + off * 90, 90) + off) % 1;
                    const px = x1 + len * t;
                    const fade = Math.sin(t * Math.PI); // fade at both ends
                    return (
                      <circle
                        key={k}
                        cx={px}
                        cy={y}
                        r={5}
                        fill={c.brand}
                        opacity={0.85 * fade}
                        filter="url(#wireGlow)"
                      />
                    );
                  })
                : null}
            </g>
          );
        })}
      </svg>

      {/* ---- nodes ---- */}
      {NODES.map((n, i) => {
        const p = enter(frame, ACTIVATE[i], 170);
        const live = frame > ACTIVATE[i] + 8;
        const pulse = live ? 1 + Math.sin((frame - ACTIVATE[i]) / 11) * 0.022 : 1;
        const x = startX + gap * i;

        return (
          <div
            key={n.label}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: `translate(-50%,-50%) scale(${
                interpolate(p, [0, 1], [0.7, 1]) * pulse
              })`,
              opacity: interpolate(p, [0, 1], [0, 1], { extrapolateRight: "clamp" }),
              textAlign: "center",
              width: 210,
            }}
          >
            {/* glow halo once live */}
            {live ? (
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: 62,
                  transform: "translate(-50%,-50%)",
                  width: 190,
                  height: 190,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(0,69,255,0.20) 0%, rgba(0,69,255,0) 68%)",
                  filter: "blur(10px)",
                }}
              />
            ) : null}

            <div
              style={{
                width: 124,
                height: 124,
                margin: "0 auto",
                borderRadius: 34,
                background: "#fff",
                border: `1px solid ${live ? "rgba(0,69,255,0.35)" : c.line}`,
                boxShadow: live ? shadow.glow : shadow.card,
                display: "grid",
                placeItems: "center",
                fontSize: 46,
                color: live ? c.brand : c.faint,
                position: "relative",
              }}
            >
              {n.glyph}
            </div>
            <div
              style={{
                fontFamily: font.sans,
                fontSize: 26,
                fontWeight: 800,
                color: c.ink,
                marginTop: 18,
              }}
            >
              {n.label}
            </div>
            <div
              style={{
                fontFamily: font.sans,
                fontSize: 16,
                color: c.muted,
                marginTop: 4,
                lineHeight: 1.35,
              }}
            >
              {n.sub}
            </div>
          </div>
        );
      })}

      {/* Human-in-the-loop payoff */}
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 96 }}>
        <div style={revealUp(frame, 196)}>
          <Pill tone="ok" size={24}>
            → then one human decides · the system never deploys capital on its own
          </Pill>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
