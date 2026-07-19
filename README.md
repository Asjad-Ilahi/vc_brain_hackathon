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

Then push the schema and run:

```bash
pnpm db:push      # creates all tables in Neon
pnpm dev          # http://localhost:3000
```

The app is **live-data first**: sign up on the landing page → the 6-step onboarding calibrates
your thesis → launch fires a real radar sweep (GitHub, arXiv, Product Hunt, hackathons, patents,
accelerators, HN, web) that populates the pipeline with real founders. Auth is required for the
whole workspace and every API (scrypt-hashed passwords, HMAC-signed HTTP-only session cookies,
log out from the avatar menu) — which also stops strangers from spending your API credits on the
public deployment.

> `pnpm seed` still exists but is optional: it TRUNCATES everything (except users) and inserts 4
> fictional demo founders for a scripted walkthrough. Skip it if you want live data only.

> If `db:push` fails on esbuild, run `pnpm approve-builds` once (pnpm blocks build scripts by default).

---

## Demo script (4 minutes, maps to the rubric)

1. **Onboarding** — `/onboarding`: 6 steps (identity → fund → thesis → founder lens → signals →
   launch). "Thesis compiled. Radar armed." drops you into the command center with a live sweep.
2. **Command center** — greeting brief ("N crossed conviction threshold"), stat tiles, under-4h
   alert, global agent-activity feed.
3. **Radar (8 channels)** — GitHub, Show HN, arXiv, Product Hunt, hackathons, patents, accelerator
   cohorts, open web. Candidates crossing the thesis conviction threshold are **auto-screened** —
   assessment triggers on its own. Re-scans **enrich** existing deals (dedupe), never duplicate.
4. **Diligence** — open **VectorForge** → **Run full diligence**: Screen (a real gate — rejects
   stop the pipeline) → 3-axis → Memo → Verify, live.
5. **3 axes, never averaged** — independent cards with trend; re-scores keep prior rows (history,
   "nothing discarded") and compute trend against them.
6. **Trust Score + contradiction** — GrowthLoop's "ex-Stripe / $2M ARR" claims get **contradicted**
   by Tavily; flags roll up to the pipeline table; inline callouts appear inside the memo.
7. **Cold-start predictor** — open **CycleSense** (no GitHub/funding): the footprint sweep scores
   discourse quality / community depth / domain consistency from public evidence, states its gaps,
   and feeds the Founder axis. Honest verdicts (`insufficient_data`, confidence 0.2) — never invented.
8. **The decision is yours** — the memo only *recommends*. The **Deploy $100K / Watch / Extend
   clock 24h / Reject with feedback** panel records the human decision (`decidedBy: human`), stops
   the 24h countdown, bumps the founder's persistent score on a funded deal, and feeds channel
   intelligence.
9. **Persistence** — Memory page: every founder ever surfaced, persistent ★ score, status
   (deployed / in pipeline / tracking / passed), last-signal recency.
10. **Multi-attribute query** — top-bar search: `technical founder, EU, AI infra, no prior VC
    backing` → one-pass parse, ranked matches over bios + signals + rationales.

---

## Requirements → where it lives

| Challenge requirement | Implementation |
|---|---|
| 1 Thesis Engine (configurable) | `theses` (+ conviction threshold, founder lens, non-negotiables), `/thesis` page, `/onboarding` wizard |
| 2 Smart data collection | `services/ingest.ts` (dedupe by hash, tag by source, timestamp) + outbound opportunity dedupe (re-scan = enrich) |
| 3 Multi-attribute reasoning | `services/query.ts` — deep haystack: bios, signal text, axis rationales |
| 4 Inbound apply + screen | `/api/apply` (deck vision/PDF); screen **gates** scoring (409 unless overridden) |
| 5 Outbound identify/activate/converge | `services/sourcing.ts` — 8 channels incl. hackathons/patents/accelerators; Vercel cron; draft-only outreach; same funnel |
| 6 3-axis screening (not averaged) | `services/score.ts` — history kept, trend computed vs prior assessment |
| 7 Trust Score + external verify | `services/memo.ts` per-claim evidence + Tavily verdicts + inline memo callouts |
| 8 Investor-grade UX | warm-paper design system, 7-module workspace, countdowns, decision panel |
| Persistent Founder Score | `founders.founderScore` + history; funded deals feed back (+delta on deploy) |
| Cold-start (graded) | `services/coldstart.ts` — public-footprint predictor (see below) |
| Conviction-threshold trigger | `computeConviction` at ingestion + `autoScreenHighConviction` after sweeps |
| 24h clock | `opportunities.deadlineAt`, countdown chips, under-4h alerts, Extend +24h |
| Agentic traceability (stretch) | `reasoning_steps` (screener/footprint/scorer/memo/validator/investor) + click-to-evidence |
| Sourcing & network intelligence (stretch) | `services/channels.ts` — quality learns from funded outcomes; underexplored suggestions |
| Time-to-decision | `firstSignalAt → decidedAt` (set by the **human** decision, not the memo) |

---

## Cold-start method (Area of Research 3 — documented approach)

A pre-track-record founder often still has a public footprint. `services/coldstart.ts`:

1. **Sweep** — three Tavily queries per founder: identity + domain, social platforms
   (x.com / HN), community depth (Discords, forums, talks).
2. **Score** — structured extraction into three 0–100 sub-signals: *discourse quality*
   (technical depth of what they write), *community depth* (real engagement where practitioners
   live), *domain consistency* (sustained focus over time) — plus concrete indicators and
   **explicit gaps** ("no LinkedIn tied to the handle").
3. **Feed, don't decide** — the predictor is stored as a timestamped `social` signal in Memory and
   flows into the Founder axis as *evidence*; absence of GitHub/funding is never treated as a
   negative signal. Thin evidence → `insufficient_data` with honest low confidence, by design.

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
