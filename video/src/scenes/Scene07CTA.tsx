/**
 * SCENE 7 · 0:46–0:51 — the close.
 * Particles converge back into the mark (bookending scene 1), the promise lands
 * as one line, then everything eases to white.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Background } from "../components/Background";
import { LogoMark } from "../components/Logo";
import { Title, PrimaryButton, Sub } from "../components/Primitives";
import { c } from "../theme";
import { enter, revealUp, easeInOut } from "../utils/anim";

export const Scene07CTA: React.FC = () => {
  const frame = useCurrentFrame();

  // Final ease-to-white over the last 26 frames.
  const whiteOut = interpolate(frame, [124, 150], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeInOut,
  });

  const btn = enter(frame, 62);

  return (
    <AbsoluteFill>
      <Background intensity={0.9} />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <LogoMark frame={frame} width={480} ring delay={0} />

        <div style={{ ...revealUp(frame, 26), marginTop: 30, textAlign: "center" }}>
          <Title size={72}>
            Decide on any founder in{" "}
            <span style={{ color: c.brand }}>24 hours.</span>
          </Title>
        </div>

        <div style={{ ...revealUp(frame, 44), marginTop: 18 }}>
          <Sub size={27}>
            Sourcing · screening · diligence · evidence-backed memos
          </Sub>
        </div>

        <div
          style={{
            marginTop: 44,
            opacity: interpolate(btn, [0, 1], [0, 1], { extrapolateRight: "clamp" }),
            transform: `translateY(${interpolate(btn, [0, 1], [20, 0])}px) scale(${interpolate(
              btn,
              [0, 1],
              [0.94, 1]
            )})`,
          }}
        >
          <PrimaryButton>Open the command center →</PrimaryButton>
        </div>
      </AbsoluteFill>

      {/* graceful fade to white */}
      <AbsoluteFill style={{ background: "#fff", opacity: whiteOut }} />
    </AbsoluteFill>
  );
};
