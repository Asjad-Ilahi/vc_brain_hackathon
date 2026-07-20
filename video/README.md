# ODIN — Launch Video (Remotion)

A fully programmatic 53-second product launch film for ODIN, rendered to
1920×1080 · 30 fps · H.264 MP4. **No screenshots** — every scene is the app's
own design system (colors, cards, pills, typography from `src/app/globals.css`)
rebuilt as vector/DOM motion graphics.

## Structure

```
video/
├─ remotion.config.ts        # 1080p, CRF 16, yuv420p, overwrite
├─ scripts/
│  └─ generate-voiceover.mjs # ElevenLabs TTS — one mp3 per scene
├─ public/
│  ├─ logo.png               # the real brand asset from the app
│  └─ audio/                 # vo-<scene>.mp3 (generated) + optional music.mp3
└─ src/
   ├─ index.ts / Root.tsx    # composition registry (OdinLaunch)
   ├─ Video.tsx              # the edit: sequencing, cross-dissolves, audio sync
   ├─ theme.ts               # ODIN tokens lifted verbatim from globals.css
   ├─ audioManifest.ts       # AUTO-GENERATED — which audio files exist
   ├─ utils/
   │  ├─ timing.ts           # ⭐ single source of truth: scenes, durations, narration
   │  └─ anim.ts             # shared easing/springs/reveals (premium motion language)
   ├─ components/            # Background, Logo, product UI primitives
   └─ scenes/                # one component per scene (7 scenes)
```

## The edit (53 s)

| # | Scene         | Time        | What happens |
|---|---------------|-------------|--------------|
| 1 | Logo          | 0:00–0:05   | Mark resolves from blur, ring draws, light sweep, tagline |
| 2 | Problem       | 0:05–0:11   | A flood of grey unread decks + "21 days" counter |
| 3 | Platform      | 0:11–0:21   | The real workspace rebuilt as vectors, camera drift |
| 4 | Pipeline      | 0:21–0:31   | 5 agent nodes light up, glowing connectors, flowing packets |
| 5 | Architecture  | 0:31–0:40   | Real stack orbits the core; request/response particles |
| 6 | Features      | 0:40–0:48   | Six capability cards fly into a floating grid |
| 7 | CTA           | 0:48–0:53   | Mark returns, the 24-hour promise, fade to white |

Adjacent scenes overlap by 18 frames with an opacity+scale envelope — there are
no hard cuts anywhere.

## Commands

```bash
cd video
npm install

# 1. Narration (writes public/audio/vo-*.mp3 + rewrites audioManifest.ts)
#    Requires .env with ELEVENLABS_API_KEY=sk_...
npm run voiceover

# 2. Preview in the browser (timeline scrubber, per-scene markers)
npm run dev

# 3. Render the MP4 → out/odin-launch.mp4
npm run render
```

## Editing the film

- **Change narration or scene length** → edit `src/utils/timing.ts` only, then
  `npm run voiceover` again. The composition, audio offsets, and script all
  follow from that one file, so sync can't drift.
- **Music bed** → drop `public/audio/music.mp3` and re-run `npm run voiceover`
  (it flips `HAS_MUSIC` automatically). Volume ducks under the narration and
  fades in/out at the head/tail.
- **Brand changes** → `src/theme.ts` mirrors the app's `@theme` block; update
  both together.

## Notes

- `typescript` must stay on **5.x** (TS 7 breaks Remotion's webpack loader).
- `.env` is gitignored; never commit the ElevenLabs key. **Rotate the key** that
  was shared in chat when setting this up.
- Voice: auto-picks a calm narrator from your ElevenLabs account; pin one with
  `ELEVENLABS_VOICE_ID` in `.env`.
