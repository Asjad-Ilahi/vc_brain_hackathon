/**
 * SCENE 3 · 0:11–0:21 — the product itself.
 * The real workspace chrome, rebuilt as vectors: the blue gradient sidebar, the
 * pill search topbar, blue-circle stat tiles, and the "Ready for decision" rows
 * with the 3 independent axis scores. Everything assembles in a stagger, then
 * the camera drifts across it.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Background } from "../components/Background";
import { Card, Panel, Pill, StatTile, AxisScore, Eyebrow } from "../components/Primitives";
import { c, font, r, shadow, brandGradient } from "../theme";
import { enter, revealUp, stagger, easeOut } from "../utils/anim";

const NAV = ["Dashboard", "Thesis", "Radar", "Pipeline", "Memory", "Memos", "Diligence"];

const DEALS = [
  { co: "Helix Labs", who: "Ana Ruiz", f: 82, m: 74, i: 78, rec: "invest" },
  { co: "Everloop", who: "@mnott", f: 68, m: 71, i: 64, rec: "watch" },
  { co: "Nimbus AI", who: "Kai Tan", f: 76, m: 80, i: 72, rec: "invest" },
];

export const Scene03Platform: React.FC = () => {
  const frame = useCurrentFrame();

  // Slow lateral camera drift + tiny rotation → "floating UI" feel.
  const camX = interpolate(frame, [0, 300], [26, -26], { easing: easeOut });
  const camScale = interpolate(frame, [0, 300], [0.97, 1.02], { easing: easeOut });

  const sidebar = enter(frame, 4, 180);

  return (
    <AbsoluteFill>
      <Background intensity={0.5} panX={12} />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          transform: `translateX(${camX}px) scale(${camScale})`,
        }}
      >
        {/* ---- the workspace shell ---- */}
        <div
          style={{
            width: 1560,
            height: 830,
            display: "flex",
            gap: 22,
            filter: "drop-shadow(0 40px 90px rgba(16,19,42,0.13))",
          }}
        >
          {/* Blue gradient sidebar (the app's signature) */}
          <div
            style={{
              width: 250,
              borderRadius: 30,
              background: brandGradient,
              padding: "30px 18px",
              color: "#fff",
              transform: `translateX(${interpolate(sidebar, [0, 1], [-70, 0])}px)`,
              opacity: interpolate(sidebar, [0, 1], [0, 1], { extrapolateRight: "clamp" }),
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontFamily: font.sans,
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                padding: "0 12px 26px",
              }}
            >
              ODIN
            </div>
            {NAV.map((n, i) => {
              const p = enter(frame, stagger(i, 3, 16));
              const active = i === 0;
              return (
                <div
                  key={n}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 16px",
                    borderRadius: 18,
                    marginBottom: 6,
                    background: active ? "#fff" : "transparent",
                    color: active ? c.brand : "rgba(255,255,255,0.85)",
                    fontFamily: font.sans,
                    fontSize: 18,
                    fontWeight: 700,
                    opacity: interpolate(p, [0, 1], [0, 1], { extrapolateRight: "clamp" }),
                    transform: `translateX(${interpolate(p, [0, 1], [-14, 0])}px)`,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 3,
                      background: active ? c.brand : "rgba(255,255,255,0.6)",
                    }}
                  />
                  {n}
                </div>
              );
            })}
          </div>

          {/* Main column */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Topbar: search pill + account pill */}
            <div style={{ display: "flex", gap: 16, ...revealUp(frame, 14, 18) }}>
              <div
                style={{
                  flex: 1,
                  background: "#fff",
                  borderRadius: r.pill,
                  border: `1px solid ${c.line}`,
                  boxShadow: shadow.card,
                  padding: "20px 30px",
                  color: c.faint,
                  fontFamily: font.sans,
                  fontSize: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={c.faint} strokeWidth="1.9">
                  <circle cx="9" cy="9" r="6" />
                  <path d="m17 17-3.2-3.2" />
                </svg>
                Search founders, companies, memos…
              </div>
              <div
                style={{
                  background: "#fff",
                  borderRadius: r.pill,
                  border: `1px solid ${c.line}`,
                  boxShadow: shadow.card,
                  padding: "20px 30px",
                  fontFamily: font.sans,
                  fontSize: 20,
                  fontWeight: 700,
                  color: c.ink,
                }}
              >
                Maschmeyer Partner
              </div>
            </div>

            {/* Stat row */}
            <div style={{ display: "flex", gap: 18 }}>
              {[
                { l: "On the clock", v: 9, icon: "◷" },
                { l: "Sourced today", v: 24, icon: "◎" },
                { l: "Memos ready", v: 6, icon: "▤" },
                { l: "Avg decision", v: "3.4h", icon: "⚡" },
              ].map((s, i) => (
                <div key={s.l} style={{ flex: 1, ...revealUp(frame, stagger(i, 5, 26), 24) }}>
                  <StatTile label={s.l} value={s.v} icon={s.icon} />
                </div>
              ))}
            </div>

            {/* Ready-for-decision panel with 3-axis rows */}
            <div style={{ flex: 1, ...revealUp(frame, 50, 30) }}>
              <Panel style={{ height: "100%" }} pad={28}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <Eyebrow style={{ fontSize: 17 }}>Ready for your decision</Eyebrow>
                  <Pill tone="ok" size={17}>3 memos complete</Pill>
                </div>

                {DEALS.map((d, i) => {
                  const p = enter(frame, stagger(i, 9, 66));
                  return (
                    <div
                      key={d.co}
                      style={{
                        opacity: interpolate(p, [0, 1], [0, 1], { extrapolateRight: "clamp" }),
                        transform: `translateY(${interpolate(p, [0, 1], [26, 0])}px)`,
                        marginBottom: 14,
                      }}
                    >
                      <Card pad={22} style={{ display: "flex", alignItems: "center", gap: 26 }}>
                        <div style={{ width: 300 }}>
                          <div style={{ fontFamily: font.sans, fontSize: 26, fontWeight: 800, color: c.ink }}>
                            {d.co}
                          </div>
                          <div style={{ fontFamily: font.sans, fontSize: 18, color: c.muted, marginTop: 2 }}>
                            {d.who} · AI infrastructure
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 26, flex: 1 }}>
                          <AxisScore label="Founder" value={d.f} />
                          <AxisScore label="Market" value={d.m} />
                          <AxisScore label="Idea vs market" value={d.i} />
                        </div>
                        <Pill tone={d.rec === "invest" ? "ok" : "warn"} size={17}>
                          recommends {d.rec}
                        </Pill>
                      </Card>
                    </div>
                  );
                })}
              </Panel>
            </div>
          </div>
        </div>
      </AbsoluteFill>

      {/* Caption */}
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 42 }}>
        <div style={revealUp(frame, 100)}>
          <Pill tone="brand" size={22}>
            One command center · source · screen · decide
          </Pill>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
