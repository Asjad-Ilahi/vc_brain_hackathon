/**
 * SCENE 2 · 0:05–0:11 — the problem, told with motion instead of paragraphs.
 * A wall of anonymous "decks" floods in and greys out, while a counter of days
 * spins up. Three short stabs of text carry the point.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Background } from "../components/Background";
import { Title, Sub, Card } from "../components/Primitives";
import { c, font, shadow } from "../theme";
import { enter, revealUp, stagger, easeOut } from "../utils/anim";

/** Deterministic layout for the flood of inbound decks. */
const rand = (s: number) => {
  const x = Math.sin(s * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const DECKS = new Array(26).fill(0).map((_, i) => ({
  x: 6 + rand(i + 3) * 88,
  y: 12 + rand(i + 40) * 74,
  rot: -14 + rand(i + 90) * 28,
  delay: 6 + i * 2.2,
  scale: 0.72 + rand(i + 140) * 0.5,
}));

export const Scene02Problem: React.FC = () => {
  const frame = useCurrentFrame();

  // Days-waiting counter spins 0 → 21
  const daysP = interpolate(frame, [70, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const days = Math.round(daysP * 21);

  return (
    <AbsoluteFill>
      <Background intensity={0.35} panX={-10} />

      {/* The flood: anonymous grey deck cards raining in and stacking up */}
      <AbsoluteFill>
        {DECKS.map((d, i) => {
          const p = enter(frame, d.delay, 160);
          const drift = interpolate(frame - d.delay, [0, 120], [0, 16], {
            extrapolateLeft: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${d.x}%`,
                top: `${d.y}%`,
                width: 150 * d.scale,
                height: 100 * d.scale,
                borderRadius: 14,
                background: "#fff",
                border: `1px solid ${c.line}`,
                boxShadow: shadow.card,
                transform: `translate(-50%,-50%) rotate(${d.rot}deg) translateY(${
                  interpolate(p, [0, 1], [-160, drift])
                }px) scale(${interpolate(p, [0, 1], [0.6, 1])})`,
                opacity: interpolate(p, [0, 1], [0, 0.85], {
                  extrapolateRight: "clamp",
                }),
                filter: "grayscale(1)",
                padding: 12,
              }}
            >
              {/* skeleton lines — an unread deck */}
              <div style={{ height: 7, width: "62%", background: c.line, borderRadius: 4 }} />
              <div style={{ height: 6, width: "88%", background: c.line, borderRadius: 4, marginTop: 8 }} />
              <div style={{ height: 6, width: "74%", background: c.line, borderRadius: 4, marginTop: 6 }} />
            </div>
          );
        })}
      </AbsoluteFill>

      {/* Soft white scrim so the copy stays legible over the flood */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 62% 58% at 50% 50%, rgba(255,255,255,0.94) 40%, rgba(255,255,255,0.5) 100%)",
        }}
      />

      <AbsoluteFill
        style={{ justifyContent: "center", alignItems: "center", textAlign: "center" }}
      >
        <div style={revealUp(frame, 10)}>
          <Title size={96}>Too many decks.</Title>
        </div>
        <div style={{ ...revealUp(frame, stagger(1, 12, 10)), marginTop: 6 }}>
          <Title size={96} style={{ color: c.brand }}>
            Too little time.
          </Title>
        </div>

        <div style={{ ...revealUp(frame, 62), marginTop: 40 }}>
          <Card
            pad={26}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 26,
              boxShadow: shadow.lift,
            }}
          >
            <div style={{ textAlign: "left" }}>
              <div
                style={{
                  fontFamily: font.sans,
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: c.faint,
                }}
              >
                Average founder wait
              </div>
              <div
                style={{
                  fontFamily: font.sans,
                  fontSize: 62,
                  fontWeight: 800,
                  color: c.bad,
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {days} days
              </div>
            </div>
            <div style={{ width: 1, height: 74, background: c.line }} />
            <Sub size={26} style={{ maxWidth: 340, textAlign: "left" }}>
              Most never get an answer at all.
            </Sub>
          </Card>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
