# VC Brain — Founder Intelligence

An AI operating system for a venture fund: **discover founders → screen → 3-axis diligence →
evidence-backed memo with a Trust Score**, fast enough to decide on a $100K check in 24 hours.
Built for the Maschmeyer Group "VC Brain" challenge (Hack-Nation 6th Global AI Hackathon).

Serverless by design — one Next.js app on Vercel, Neon Postgres, no separate backend.

---

## Stack

| Layer | Choice |
|---|---|
| App + API | Next.js 16 (App Router, route handlers) on **Vercel** |
| DB | **Neon Postgres** via Drizzle ORM (neon-http serverless driver) |
| LLM | **OpenAI** (`gpt-4o`) — structured output + vision, validated with Zod |
| Web search / verification | **Tavily** (outbound sourcing + external claim checks) |
| Dev signal | **GitHub** REST API (outbound sourcing) |
| PDF intake | `unpdf` (serverless-safe) |

The only hard runtime dependency is an LLM key; everything else is optional/free.

---

## Setup (≈5 minutes)

```bash
pnpm install                      # already done if node_modules exists
cp .env.example .env.local        # then fill in the values below
```

Fill `.env.local`:

1. **Neon** → create a free project at https://neon.tech (or Vercel → Storage → Postgres).
   Copy the **pooled** connection string into `DATABASE_URL`.
2. **OpenAI** → redeem your hackathon credit, create an API key → `OPENAI_API_KEY`.
3. **Tavily** → use the shared hackathon code → `TAVILY_API_KEY`.
4. **GitHub** (optional) → a classic PAT with `public_repo` scope → `GITHUB_TOKEN`.

Then push the schema and seed the demo data:

```bash
pnpm db:push      # creates all tables in Neon
pnpm seed         # 1 thesis + 4 hero founders (strong / contradictory / cold-start / returning)
pnpm dev          # http://localhost:3000
```

> If `db:push` fails on esbuild, run `pnpm approve-builds` once (pnpm blocks build scripts by default).

---

## Demo script (3 minutes, maps to the rubric)

1. **Thesis (configurable)** — click *edit* on the thesis chips; change a sector → the list re-ranks.
2. **Inbound** — open a seeded deal (e.g. **GrowthLoop AI**) → **Run full diligence**. Watch
   Screen → 3-axis → Memo → Verify run live.
3. **3 axes, never averaged** — three independent cards (Founder / Market / Idea-vs-Market), each with a trend.
4. **Trust Score + contradiction** — GrowthLoop's "ex-Stripe / $2M ARR" claims get **contradicted**
   by Tavily; the claim row turns red with the note.
5. **Cold-start** — open **CycleSense** (Lena Ortiz, no GitHub/funding) → still gets a reasoned,
   low-confidence score, marked cold-start.
6. **Persistence** — open **InferEdge** (Sam Okafor) → Founder Score history shows it carried across
   his prior exit — never reset.
7. **Outbound** — click **Source: GitHub** / **Source: Web** → new founders appear and run the *same*
   pipeline; draft (not send) outreach.
8. **Multi-attribute query** — type `technical founder, EU, AI infra, no prior VC backing` → ranked
   matches with the parsed filter shown.
9. **Speed** — the **Avg time to decision** metric (first signal → recommendation) is on the dashboard.

---

## Requirements → where it lives

| Challenge requirement | Implementation |
|---|---|
| 1 Thesis Engine (configurable) | `theses` table, `/api/thesis`, thesis modal |
| 2 Smart data collection | `services/ingest.ts` (dedupe by hash, tag by source, timestamp) |
| 3 Multi-attribute reasoning | `services/query.ts`, `/api/query` |
| 4 Inbound apply + screen | `/api/apply` (deck vision/PDF), `services/screen.ts` |
| 5 Outbound identify/activate/converge | `services/sourcing.ts`, `/api/source/*`, `services/outreach.ts` |
| 6 3-axis screening (not averaged) | `services/score.ts`, `axis_scores` (3 rows), `AxisCard` |
| 7 Trust Score + external verify | `services/memo.ts` (`buildMemo` + `verifyMemoClaims` via Tavily) |
| 8 Investor-grade UX | `_components/Dashboard.tsx`, `OpportunityDetail.tsx` |
| Persistent Founder Score | `founders.founderScore` + `founder_score_history` (upsert by canonical handle) |
| Cold-start | explicit path in the scorer prompt + `isColdStart` flag |
| Agentic traceability (stretch) | `reasoning_steps` + click-to-evidence on claims |
| Time-to-decision | `opportunities.firstSignalAt → decidedAt` metric |

---

## Deploy to Vercel

```bash
git init && git add -A && git commit -m "VC Brain"
# push to GitHub, then import the repo in Vercel
```

In Vercel: New Project → import the repo → add the same env vars → Deploy. Point `pnpm db:push`
(and optionally `pnpm seed`) at the same Neon database once.

Serverless notes: the DB uses Neon's HTTP driver (no pooling issues), each heavy route sets
`maxDuration = 60`, and the diligence pipeline runs as separate client-orchestrated steps to stay
under the function timeout.

---

## Project map

```
src/
  db/schema.ts          # Memory: founders, score history, companies, opportunities,
                        #   signals, axis_scores, memos, claims, reasoning_steps, ...
  db/client.ts          # lazy Neon HTTP Drizzle client (build-safe without creds)
  db/seed.ts            # deterministic demo data
  lib/openai.ts         # structured output (JSON + Zod validate + retry) & vision
  lib/tavily.ts         # web search + claim verification
  lib/github.ts         # outbound dev signal
  lib/schemas.ts        # Zod contracts for every LLM output
  lib/services/         # ingest, thesis, deck, screen, score, memo, sourcing, query, outreach
  app/api/              # serverless route handlers
  app/_components/      # Dashboard + OpportunityDetail + UI primitives
```
