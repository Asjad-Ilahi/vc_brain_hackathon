/**
 * SCENE 5 · 0:31–0:39 — the real stack, not a generic cloud diagram.
 * ODIN sits at the centre; the actual services orbit it (Next.js, Neon
 * Postgres + Drizzle, GPT-4o, Tavily, Vercel, SMTP). Data packets travel along
 * each spoke to show the request path.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Background } from "../components/Background";
import { Eyebrow, Title } from "../components/Primitives";
import { c, font, shadow, brandGradient } from "../theme";
import { enter, revealUp, easeOut, loop } from "../utils/anim";

/** The genuine stack from package.json / lib. */
const STACK = [
  { name: "Next.js 16", role: "App Router · serverless", angle: -90 },
  { name: "Neon Postgres", role: "Drizzle ORM", angle: -18 },
  { name: "OpenAI GPT-4o", role: "structured outputs", angle: 54 },
  { name: "Tavily", role: "live web verification", angle: 126 },
  { name: "Vercel", role: "edge + cron", angle: 198 },
];

const CX = 960;
const CY = 604;
const RADIUS = 298;

export const Scene05Architecture: React.FC = () => {
  const frame = useCurrentFrame();

  // Whole diagram rotates a few degrees for life.
  const drift = Math.sin(frame / 150) * 2.2;
  const core = enter(frame, 10, 200);

  return (
    <AbsoluteFill>
      <Background intensity={0.6} panY={10} />

      <AbsoluteFill style={{ alignItems: "center", paddingTop: 96 }}>
        <div style={revealUp(frame, 2)}>
          <Eyebrow>Architecture</Eyebrow>
        </div>
        <div style={{ ...revealUp(frame, 10), marginTop: 12 }}>
          <Title size={62}>Serverless. Production ready.</Title>
        </div>
      </AbsoluteFill>

      {/* spokes + packets */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <filter id="spokeGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {STACK.map((s, i) => {
          const a = ((s.angle + drift) * Math.PI) / 180;
          const nx = CX + Math.cos(a) * RADIUS;
          const ny = CY + Math.sin(a) * RADIUS;
          const appear = interpolate(frame, [26 + i * 8, 56 + i * 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: easeOut,
          });
          // inner start point (edge of the core disc)
          const sx = CX + Math.cos(a) * 128;
          const sy = CY + Math.sin(a) * 128;
          const ex = sx + (nx - sx) * appear;
          const ey = sy + (ny - sy) * appear;

          return (
            <g key={s.name}>
              <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={c.linestrong} strokeWidth={2} />
              {appear > 0.98
                ? [0, 0.5].map((off, k) => {
                    // packets travel outward then back (request → response)
                    const t = (loop(frame + off * 70, 70) + off) % 1;
                    const bounce = t < 0.5 ? t * 2 : (1 - t) * 2;
                    const px = sx + (nx - sx) * bounce;
                    const py = sy + (ny - sy) * bounce;
                    return (
                      <circle
                        key={k}
                        cx={px}
                        cy={py}
                        r={4.5}
                        fill={c.brand}
                        opacity={0.9 * Math.sin(bounce * Math.PI)}
                        filter="url(#spokeGlow)"
                      />
                    );
                  })
                : null}
            </g>
          );
        })}
      </svg>

      {/* core */}
      <div
        style={{
          position: "absolute",
          left: CX,
          top: CY,
          transform: `translate(-50%,-50%) scale(${interpolate(core, [0, 1], [0.7, 1])})`,
          opacity: interpolate(core, [0, 1], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <div
          style={{
            width: 236,
            height: 236,
            borderRadius: "50%",
            background: brandGradient,
            display: "grid",
            placeItems: "center",
            color: "#fff",
            fontFamily: font.sans,
            fontWeight: 800,
            fontSize: 44,
            letterSpacing: "-0.02em",
            boxShadow: "0 24px 70px rgba(0,69,255,0.42)",
          }}
        >
          ODIN
        </div>
      </div>

      {/* service chips */}
      {STACK.map((s, i) => {
        const a = ((s.angle + drift) * Math.PI) / 180;
        const nx = CX + Math.cos(a) * RADIUS;
        const ny = CY + Math.sin(a) * RADIUS;
        const p = enter(frame, 40 + i * 8, 180);
        return (
          <div
            key={s.name}
            style={{
              position: "absolute",
              left: nx,
              top: ny,
              transform: `translate(-50%,-50%) scale(${interpolate(p, [0, 1], [0.75, 1])})`,
              opacity: interpolate(p, [0, 1], [0, 1], { extrapolateRight: "clamp" }),
              background: "#fff",
              border: `1px solid ${c.line}`,
              boxShadow: shadow.card,
              borderRadius: 20,
              padding: "18px 26px",
              textAlign: "center",
              minWidth: 210,
            }}
          >
            <div style={{ fontFamily: font.sans, fontSize: 24, fontWeight: 800, color: c.ink }}>
              {s.name}
            </div>
            <div style={{ fontFamily: font.sans, fontSize: 16, color: c.muted, marginTop: 3 }}>
              {s.role}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
