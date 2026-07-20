/**
 * The edit. Scenes are laid out back-to-back but each visual sequence is
 * extended by CROSSFADE frames and wrapped in an opacity/scale envelope, so
 * adjacent scenes cross-dissolve — there is never a hard cut.
 *
 * Narration is placed in its own sequences at each scene's TRUE start frame, so
 * the voiceover stays locked to the visuals regardless of the visual overlap.
 */
import React from "react";
import { AbsoluteFill, Sequence, Audio, staticFile, useCurrentFrame } from "remotion";
import { loadFont as loadUrbanist } from "@remotion/google-fonts/Urbanist";

import { SCENES, CROSSFADE, sceneStart, audioFileFor, TOTAL_FRAMES } from "./utils/timing";
import { sceneEnvelope } from "./utils/anim";
import { VO_AVAILABLE, HAS_MUSIC, MUSIC_VOLUME } from "./audioManifest";
import { c, font } from "./theme";

import { Scene01Logo } from "./scenes/Scene01Logo";
import { Scene02Problem } from "./scenes/Scene02Problem";
import { Scene03Platform } from "./scenes/Scene03Platform";
import { Scene04Pipeline } from "./scenes/Scene04Pipeline";
import { Scene05Architecture } from "./scenes/Scene05Architecture";
import { Scene06Features } from "./scenes/Scene06Features";
import { Scene07CTA } from "./scenes/Scene07CTA";

// Load the product's typeface so the video matches the app exactly.
const { fontFamily } = loadUrbanist();

const SCENE_COMPONENTS = {
  logo: Scene01Logo,
  problem: Scene02Problem,
  platform: Scene03Platform,
  pipeline: Scene04Pipeline,
  architecture: Scene05Architecture,
  features: Scene06Features,
  cta: Scene07CTA,
} as const;

/** Applies the cross-dissolve envelope to whatever scene it wraps. */
const SceneWrap: React.FC<{ duration: number; children: React.ReactNode }> = ({
  duration,
  children,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={sceneEnvelope(frame, duration, CROSSFADE)}>
      {children}
    </AbsoluteFill>
  );
};

export const OdinLaunch: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: c.canvas,
        fontFamily: `${fontFamily}, ${font.sans}`,
      }}
    >
      {/* ---------------------------- visuals ---------------------------- */}
      {SCENES.map((s, i) => {
        const trueStart = sceneStart(s.key);
        // Overlap into the previous scene (except the first) and past the end,
        // so the envelope has room to dissolve on both sides.
        const from = i === 0 ? 0 : trueStart - CROSSFADE;
        const isLast = i === SCENES.length - 1;
        const duration =
          s.durationInFrames +
          (i === 0 ? 0 : CROSSFADE) +
          (isLast ? 0 : CROSSFADE);

        const Comp = SCENE_COMPONENTS[s.key];
        return (
          <Sequence key={s.key} from={from} durationInFrames={duration} name={s.key}>
            <SceneWrap duration={duration}>
              <Comp />
            </SceneWrap>
          </Sequence>
        );
      })}

      {/* -------------------------- narration ---------------------------- */}
      {/* One mp3 per scene, placed at the scene's exact start = perfect sync. */}
      {SCENES.map((s) =>
        VO_AVAILABLE.includes(s.key) ? (
          <Sequence
            key={`vo-${s.key}`}
            from={sceneStart(s.key)}
            durationInFrames={s.durationInFrames}
            name={`vo-${s.key}`}
          >
            <Audio src={staticFile(audioFileFor(s.key))} />
          </Sequence>
        ) : null
      )}

      {/* ------------------------ music bed (optional) -------------------- */}
      {HAS_MUSIC ? (
        <Audio
          src={staticFile("audio/music.mp3")}
          volume={(f) =>
            // gentle fade in at the head, fade out under the final white-out
            f < 30
              ? (f / 30) * MUSIC_VOLUME
              : f > TOTAL_FRAMES - 45
              ? Math.max(0, (TOTAL_FRAMES - f) / 45) * MUSIC_VOLUME
              : MUSIC_VOLUME
          }
        />
      ) : null}
    </AbsoluteFill>
  );
};
