/**
 * Single source of truth for the edit. Every scene, its length, and the
 * narration line it is synced to live here — change a duration in one place and
 * the composition, the audio offsets and the voiceover script all follow.
 *
 * 30 fps · 1920x1080 · total 1530 frames = 51 seconds.
 */

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export type SceneKey =
  | "logo"
  | "problem"
  | "platform"
  | "pipeline"
  | "architecture"
  | "features"
  | "cta";

export type SceneDef = {
  key: SceneKey;
  /** Duration in frames. */
  durationInFrames: number;
  /** Narration for this scene — fed to ElevenLabs, one mp3 per scene. */
  narration: string;
};

/**
 * Scenes are sequenced back-to-back. Each scene renders its own transition
 * in/out, and adjacent scenes overlap by CROSSFADE frames so nothing hard-cuts.
 */
export const SCENES: SceneDef[] = [
  {
    key: "logo",
    durationInFrames: 158, // 0:00 – 0:05
    narration:
      "This is ODIN. An AI operating system for autonomous venture intelligence.",
  },
  {
    key: "problem",
    durationInFrames: 180, // 0:05 – 0:11  (VO ~5.4s)
    narration:
      "Funds drown in inbound decks. Founders wait weeks. Most never get an answer.",
  },
  {
    key: "platform",
    durationInFrames: 300, // 0:11 – 0:21  (VO ~9.2s)
    narration:
      "ODIN runs the whole fund from one command center. It sources founders before they raise, screens every deal, and writes the memo.",
  },
  {
    key: "pipeline",
    durationInFrames: 300, // 0:21 – 0:31  (VO ~9.6s)
    narration:
      "An autonomous agent pipeline. Signals are screened against your thesis, scored on three axes, drafted into a memo, then every claim is verified.",
  },
  {
    key: "architecture",
    durationInFrames: 270, // 0:31 – 0:39  (VO ~7.1s)
    narration:
      "Built on Next.js, Neon Postgres, GPT 4 o for reasoning, and Tavily for live verification. Serverless and production ready.",
  },
  {
    key: "features",
    durationInFrames: 240, // 0:39 – 0:46  (VO ~6.2s)
    narration:
      "Persistent founder memory. A twenty four hour clock. Per claim trust scores. One human decides.",
  },
  {
    key: "cta",
    durationInFrames: 150, // 0:46 – 0:51
    narration: "ODIN. Decide on any founder in twenty four hours.",
  },
];

/** Frames of overlap between adjacent scenes (cross-dissolve, no hard cuts). */
export const CROSSFADE = 18;

export const TOTAL_FRAMES = SCENES.reduce(
  (sum, s) => sum + s.durationInFrames,
  0
);

/** Absolute start frame of each scene (back-to-back, no gaps). */
export function sceneStart(key: SceneKey): number {
  let f = 0;
  for (const s of SCENES) {
    if (s.key === key) return f;
    f += s.durationInFrames;
  }
  return f;
}

/** Convenience for the voiceover generator + audio track. */
export const audioFileFor = (key: SceneKey) => `audio/vo-${key}.mp3`;
