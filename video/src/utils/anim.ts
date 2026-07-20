/**
 * Shared motion language. Every scene pulls its easing/springs from here so the
 * whole film feels like one system (premium easing, nothing linear).
 */
import { interpolate, spring, Easing } from "remotion";
import { FPS } from "./timing";

/** Apple-ish "expo out" — fast start, long graceful settle. Our default. */
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
/** Soft symmetric ease for opacity/blur cross-dissolves. */
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** Standard entrance spring (slightly damped, no cartoon overshoot). */
export const enter = (frame: number, delay = 0, damping = 200) =>
  spring({
    frame: frame - delay,
    fps: FPS,
    config: { damping, mass: 0.9, stiffness: 120 },
  });

/** A touch of overshoot for badges/pills that should feel "snappy". */
export const pop = (frame: number, delay = 0) =>
  spring({
    frame: frame - delay,
    fps: FPS,
    config: { damping: 14, mass: 0.6, stiffness: 180 },
  });

/**
 * Fade + rise + de-blur: the signature reveal used across the video.
 * Returns a style object ready to spread onto any element.
 */
export const revealUp = (
  frame: number,
  delay = 0,
  distance = 28
): React.CSSProperties => {
  const p = enter(frame, delay);
  return {
    opacity: interpolate(p, [0, 1], [0, 1], { extrapolateRight: "clamp" }),
    transform: `translateY(${interpolate(p, [0, 1], [distance, 0])}px)`,
    filter: `blur(${interpolate(p, [0, 1], [10, 0], {
      extrapolateRight: "clamp",
    })}px)`,
  };
};

/** Staggered delay helper — index * step, with an optional base offset. */
export const stagger = (i: number, step = 5, base = 0) => base + i * step;

/**
 * Scene-level in/out envelope. Fades + subtly scales the whole scene so
 * adjacent scenes cross-dissolve instead of cutting.
 */
export const sceneEnvelope = (
  frame: number,
  duration: number,
  fade = 18
): React.CSSProperties => {
  const opacity = interpolate(
    frame,
    [0, fade, duration - fade, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut }
  );
  // Very slow continuous push-in gives every scene a "camera" feel.
  const scale = interpolate(frame, [0, duration], [1, 1.04], {
    extrapolateRight: "clamp",
    easing: Easing.linear,
  });
  return { opacity, transform: `scale(${scale})` };
};

/** Loops a value 0→1 over `period` frames (for orbiting particles etc). */
export const loop = (frame: number, period: number) =>
  (frame % period) / period;
