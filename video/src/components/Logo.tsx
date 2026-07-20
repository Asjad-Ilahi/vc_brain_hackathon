/**
 * ODIN mark. Uses the real `logo.png` from the app's /public so the video uses
 * the actual brand asset, wrapped in a vector "intelligence ring" that draws on
 * — the O of ODIN echoed as an animated arc.
 */
import React from "react";
import { Img, staticFile, interpolate, useCurrentFrame } from "remotion";
import { c } from "../theme";
import { enter, easeOut } from "../utils/anim";

export const LogoMark: React.FC<{
  /** Frame local to the logo's own entrance. */
  frame: number;
  width?: number;
  /** Show the orbiting ring + glow (scene 1 / CTA). */
  ring?: boolean;
  delay?: number;
}> = ({ frame, width = 620, ring = true, delay = 0 }) => {
  const p = enter(frame, delay, 220);
  const scale = interpolate(p, [0, 1], [0.86, 1]);
  const opacity = interpolate(p, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const blur = interpolate(p, [0, 1], [16, 0], { extrapolateRight: "clamp" });

  // Ring draws on, then slowly rotates forever.
  const draw = interpolate(frame - delay, [10, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const spin = (frame - delay) * 0.28;
  const R = width * 0.62;
  const CIRC = 2 * Math.PI * R;

  return (
    <div
      style={{
        position: "relative",
        display: "grid",
        placeItems: "center",
        opacity,
        transform: `scale(${scale})`,
        filter: `blur(${blur}px)`,
      }}
    >
      {ring ? (
        <>
          {/* Soft brand glow behind the mark */}
          <div
            style={{
              position: "absolute",
              width: R * 2.1,
              height: R * 2.1,
              borderRadius: "50%",
              background: `radial-gradient(circle, rgba(0,69,255,0.16) 0%, rgba(0,69,255,0) 65%)`,
              filter: "blur(30px)",
            }}
          />
          {/* Drawing arc */}
          <svg
            width={R * 2.3}
            height={R * 2.3}
            viewBox={`0 0 ${R * 2.3} ${R * 2.3}`}
            style={{
              position: "absolute",
              transform: `rotate(${spin}deg)`,
            }}
          >
            <defs>
              <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={c.brand} stopOpacity="0" />
                <stop offset="55%" stopColor={c.brand} stopOpacity="0.9" />
                <stop offset="100%" stopColor={c.brandlight} stopOpacity="0.15" />
              </linearGradient>
            </defs>
            <circle
              cx={R * 1.15}
              cy={R * 1.15}
              r={R}
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - draw * 0.78)}
            />
          </svg>
        </>
      ) : null}

      <Img
        src={staticFile("logo.png")}
        style={{
          width,
          objectFit: "contain",
          position: "relative",
          // The asset has a white background box — multiply blends it into the
          // light canvas so only the mark shows.
          mixBlendMode: "multiply",
        }}
      />
    </div>
  );
};

/** Text lockup used under the mark. */
export const LogoTagline: React.FC<{ frame: number; delay?: number }> = ({
  frame,
  delay = 0,
}) => {
  const p = enter(frame, delay);
  return (
    <div
      style={{
        opacity: interpolate(p, [0, 1], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateY(${interpolate(p, [0, 1], [22, 0])}px)`,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: "0.02em",
          color: c.muted,
        }}
      >
        AI Operating System for Autonomous Venture Intelligence
      </div>
    </div>
  );
};
