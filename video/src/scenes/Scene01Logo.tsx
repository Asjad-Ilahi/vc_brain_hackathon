/**
 * SCENE 1 · 0:00–0:05 — "This is ODIN."
 * Cold open: particles converge, the mark resolves out of blur, the ring draws,
 * the tagline rises. Sets the film's visual grammar (light canvas, brand blue).
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Background } from "../components/Background";
import { LogoMark, LogoTagline } from "../components/Logo";
import { Pill } from "../components/Primitives";
import { c } from "../theme";
import { enter, easeOut } from "../utils/anim";

export const Scene01Logo: React.FC = () => {
  const frame = useCurrentFrame();

  // A slow push-in on the whole lockup — cinematic "settle". Kept subtle so the
  // ring never crosses the frame edge (safe margins).
  const push = interpolate(frame, [0, 150], [1.025, 1], {
    extrapolateRight: "clamp",
    easing: easeOut,
  });

  // Light sweep across the mark once it lands.
  const sweep = interpolate(frame, [46, 86], [-40, 140], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const sweepOpacity = interpolate(frame, [46, 60, 86], [0, 0.5, 0], {
    extrapolateRight: "clamp",
  });

  const badge = enter(frame, 78);

  return (
    <AbsoluteFill>
      <Background intensity={0.75} />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          transform: `scale(${push})`,
        }}
      >
        <div style={{ position: "relative", display: "grid", placeItems: "center" }}>
          <LogoMark frame={frame} width={470} ring delay={4} />

          {/* Specular sweep — a single pass of light over the mark */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              pointerEvents: "none",
              maskImage: "linear-gradient(black, black)",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-30%",
                left: `${sweep}%`,
                width: "22%",
                height: "160%",
                background:
                  "linear-gradient(105deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0) 100%)",
                opacity: sweepOpacity,
                transform: "rotate(8deg)",
                filter: "blur(6px)",
              }}
            />
          </div>
        </div>

        <div style={{ height: 22 }} />
        <LogoTagline frame={frame} delay={54} />

        <div
          style={{
            height: 24,
          }}
        />
        <div
          style={{
            opacity: interpolate(badge, [0, 1], [0, 1], {
              extrapolateRight: "clamp",
            }),
            transform: `translateY(${interpolate(badge, [0, 1], [16, 0])}px)`,
          }}
        >
          <Pill tone="brand" size={20}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: c.brand,
                display: "inline-block",
              }}
            />
            Maschmeyer Group · AI Venture Capital Challenge
          </Pill>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
