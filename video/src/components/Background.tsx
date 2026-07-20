/**
 * The film's shared canvas: the app's light `#f7f8fb` page colour, a faint dot
 * grid (echoing the product's card grid), two slow-drifting brand-blue glow
 * orbs for depth, and floating particles. Every scene sits on this so cuts feel
 * like camera moves across one continuous space.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { c } from "../theme";
import { loop } from "../utils/anim";

type Props = {
  /** 0 = calm, 1 = energetic (more particle motion + brighter orbs). */
  intensity?: number;
  /** Parallax offset so scenes can feel like different parts of one space. */
  panX?: number;
  panY?: number;
};

/** Deterministic pseudo-random so renders are reproducible frame to frame. */
const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const PARTICLES = new Array(38).fill(0).map((_, i) => ({
  x: rand(i + 1) * 100,
  y: rand(i + 51) * 100,
  size: 2 + rand(i + 101) * 4,
  period: 260 + rand(i + 151) * 420,
  drift: 12 + rand(i + 201) * 40,
  opacity: 0.18 + rand(i + 251) * 0.35,
}));

export const Background: React.FC<Props> = ({
  intensity = 0.6,
  panX = 0,
  panY = 0,
}) => {
  const frame = useCurrentFrame();

  // Two large, very soft radial orbs drifting on long sine paths → depth.
  const orbA = {
    x: 22 + Math.sin(frame / 220) * 6 + panX * 0.4,
    y: 26 + Math.cos(frame / 260) * 5 + panY * 0.4,
  };
  const orbB = {
    x: 78 + Math.cos(frame / 300) * 7 + panX * 0.25,
    y: 72 + Math.sin(frame / 240) * 6 + panY * 0.25,
  };

  return (
    <AbsoluteFill style={{ backgroundColor: c.canvas, overflow: "hidden" }}>
      {/* Depth orbs — brand blue, heavily blurred */}
      <div
        style={{
          position: "absolute",
          left: `${orbA.x}%`,
          top: `${orbA.y}%`,
          width: 900,
          height: 900,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(0,69,255,${
            0.1 + intensity * 0.09
          }) 0%, rgba(0,69,255,0) 68%)`,
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `${orbB.x}%`,
          top: `${orbB.y}%`,
          width: 760,
          height: 760,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(95,131,255,${
            0.09 + intensity * 0.08
          }) 0%, rgba(95,131,255,0) 70%)`,
          filter: "blur(40px)",
        }}
      />

      {/* Faint dot grid — the product's structural rhythm, parallaxed */}
      <div
        style={{
          position: "absolute",
          inset: -60,
          backgroundImage: `radial-gradient(${c.linestrong} 1.1px, transparent 1.1px)`,
          backgroundSize: "46px 46px",
          backgroundPosition: `${panX * 0.6 + Math.sin(frame / 400) * 6}px ${
            panY * 0.6 + frame * 0.06
          }px`,
          opacity: 0.5,
          maskImage:
            "radial-gradient(ellipse 75% 65% at 50% 45%, black 40%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 75% 65% at 50% 45%, black 40%, transparent 100%)",
        }}
      />

      {/* Floating particles — slow vertical drift + gentle horizontal sway */}
      {PARTICLES.map((p, i) => {
        const t = loop(frame + i * 17, p.period);
        const y = p.y - t * p.drift;
        const sway = Math.sin((frame + i * 30) / 90) * 1.4;
        const twinkle = interpolate(
          Math.sin((frame + i * 24) / 40),
          [-1, 1],
          [0.45, 1]
        );
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${p.x + sway + panX * 0.15}%`,
              top: `${((y % 100) + 100) % 100}%`,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: c.brand,
              opacity: p.opacity * twinkle * (0.5 + intensity * 0.7),
              filter: "blur(0.4px)",
            }}
          />
        );
      })}

      {/* Top/bottom vignette keeps focus centred, like a lens */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 22%, rgba(255,255,255,0) 78%, rgba(255,255,255,0.6) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
