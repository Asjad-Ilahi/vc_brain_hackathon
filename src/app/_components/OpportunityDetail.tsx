"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { OpportunitySummary, AxisTriple } from "@/lib/services/list";
import type { Thesis } from "@/lib/services/thesis";
import type { ColdStartPredictor } from "@/lib/schemas";
import { api, postJson, fmtDuration } from "./api";
import {
  AxisCard,
  Badge,
  Countdown,
  Eyebrow,
  ScorePill,
  Spinner,
  TraceLine,
  TrendArrow,
  TrustBadge,
  scoreTone,
} from "./ui";
import { CHANNEL_SIGNAL, GhostButton, PrimaryButton } from "./shared";

type Signal = {
  id: string;
  sourceType: string;
  sourceUrl: string | null;
  title: string | null;
  rawText: string | null;
  tags: string[];
  extractedJson?: unknown;
};
type Claim = {
  id: string;
  section: string;
  claimText: string;
  evidenceSignalIds: string[];
  confidence: number;
  trustLevel: string;
  externalVerification: string;
  contradictionNote: string | null;
};
type Step = {
  id: string;
  stepOrder: number;
  agent: string;
  inputSummary: string | null;
  outputSummary: string | null;
  citedSignalIds: string[];
  createdAt?: string;
};
type Memo = { id: string; summary: string; recommendation: string | null; sectionsJson: Record<string, unknown> };
type Detail = { summary: OpportunitySummary; signals: Signal[]; memo: Memo | null; claims: Claim[]; reasoningSteps: Step[] };
type ScoreHistory = { id: string; score: number; delta: number; reason: string; milestone: string | null; createdAt: string };

type StageState = "idle" | "running" | "done" | "error";

export default function OpportunityDetail({ id }: { id: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [thesis, setThesis] = useState<Thesis | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [stages, setStages] = useState<Record<string, StageState>>({});
  const [running, setRunning] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [outreach, setOutreach] = useState<string | null>(null);
  const [histories, setHistories] = useState<Record<string, { score: number; isColdStart: boolean; history: ScoreHistory[] }>>({});

  const load = useCallback(async () => {
    try {
      const [detail, t] = await Promise.all([
        api<Detail>(`/api/opportunities/${id}`),
        api<{ active: Thesis | null }>("/api/thesis").catch(() => ({ active: null })),
      ]);
      setD(detail);
      setThesis(t.active);
      const entries = await Promise.all(
        detail.summary.founders.map(async (f) => {
          try {
            const r = await api<{ founder: { founderScore: number; isColdStart: boolean }; history: ScoreHistory[] }>(`/api/founders/${f.id}`);
            return [f.id, { score: r.founder.founderScore, isColdStart: r.founder.isColdStart, history: r.history }] as const;
          } catch {
            return null;
          }
        })
      );
      setHistories(Object.fromEntries(entries.filter(Boolean) as [string, { score: number; isColdStart: boolean; history: ScoreHistory[] }][]));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const setStage = (k: string, s: StageState) => setStages((p) => ({ ...p, [k]: s }));

  const isCold = d?.summary.founders.some((f) => f.isColdStart) ?? false;
  const footprintSignal = d?.signals.find((s) => s.sourceType === "social" && s.extractedJson);
  const predictor = (footprintSignal?.extractedJson ?? null) as ColdStartPredictor | null;

  async function runDiligence(opts?: { force?: boolean }) {
    if (!d) return;
    setErr(null);
    setRunning(true);
    try {
      let screenRes = d.summary.screenResult;
      if (!screenRes) {
        setStage("screen", "running");
        const r = await postJson<{ result: string }>(`/api/opportunities/${id}/screen`);
        screenRes = r.result;
        setStage("screen", "done");
      }
      // The screen is a real gate — rejects stop here unless overridden.
      if (screenRes === "reject" && !opts?.force) {
        setErr("Screened out before full analysis. Override below if you disagree with the gate.");
        return;
      }
      if (isCold && !footprintSignal) {
        setStage("footprint", "running");
        await postJson(`/api/opportunities/${id}/coldstart`);
        setStage("footprint", "done");
      }
      setStage("score", "running");
      await postJson(`/api/opportunities/${id}/score`, opts?.force ? { force: true } : {});
      setStage("score", "done");
      setStage("memo", "running");
      await postJson(`/api/opportunities/${id}/memo`);
      setStage("memo", "done");
      setStage("verify", "running");
      await postJson(`/api/opportunities/${id}/verify`);
      setStage("verify", "done");
    } catch (e) {
      setErr((e as Error).message);
      setStages((p) => {
        const running = Object.entries(p).find(([, v]) => v === "running");
        return running ? { ...p, [running[0]]: "error" } : p;
      });
    } finally {
      await load();
      setRunning(false);
    }
  }

  async function decide(decision: "invest" | "watch" | "pass") {
    let note: string | null = null;
    if (decision === "pass") note = window.prompt("Feedback for the founder (goes into Memory):") || null;
    setDeciding(true);
    setErr(null);
    try {
      await postJson(`/api/opportunities/${id}/decide`, { decision, note });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setDeciding(false);
    }
  }

  async function extendClock() {
    setDeciding(true);
    try {
      await postJson(`/api/opportunities/${id}/extend`);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setDeciding(false);
    }
  }

  async function draftOutreach() {
    setRunning(true);
    try {
      const r = await postJson<{ draftMessage: string }>(`/api/opportunities/${id}/outreach`);
      setOutreach(r.draftMessage);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function runFootprint() {
    setRunning(true);
    setStage("footprint", "running");
    try {
      await postJson(`/api/opportunities/${id}/coldstart`);
      setStage("footprint", "done");
      await load();
    } catch (e) {
      setErr((e as Error).message);
      setStage("footprint", "error");
    } finally {
      setRunning(false);
    }
  }

  const contradictions = useMemo(() => (d ? d.claims.filter((c) => c.externalVerification === "contradicted") : []), [d]);
  const medianClaimTrust = useMemo(() => {
    if (!d || d.claims.length === 0) return null;
    const vals = d.claims
      .map((c) => (c.trustLevel === "high" ? 90 : c.trustLevel === "medium" ? 70 : c.trustLevel === "low" ? 40 : 55))
      .sort((a, b) => a - b);
    return vals[Math.floor(vals.length / 2)];
  }, [d]);

  if (loading)
    return (
      <div className="py-24 text-center">
        <Spinner label="Loading opportunity…" />
      </div>
    );
  if (err && !d)
    return (
      <div className="py-16">
        <p className="text-[13px] text-bad">{err}</p>
        <Link href="/pipeline" className="text-[12px] text-accent hover:underline">← Pipeline</Link>
      </div>
    );
  if (!d) return null;

  const { summary: s, signals, memo, claims } = d;
  const sig = (sid: string) => signals.find((x) => x.id === sid);
  const sections = (memo?.sectionsJson ?? {}) as {
    companySnapshot?: string;
    investmentHypotheses?: string[];
    swot?: { strengths?: string[]; weaknesses?: string[]; opportunities?: string[]; risks?: string[] };
    problemProduct?: string;
    tractionKpis?: string;
    gaps?: string[];
  };
  const checkK = Math.round((thesis?.checkSizeMinUsd ?? 100_000) / 1000);
  const ownPct = thesis?.ownershipTargetPct ?? 7;
  const founderName = s.founders[0]?.name;
  const rejected = s.screenResult === "reject";
  const screened = stages.screen ?? (s.screenResult ? "done" : "idle");
  const claimsBySection = (needle: string[]) =>
    contradictions.filter((c) => needle.some((n) => c.section.toLowerCase().includes(n)));

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <Link href="/pipeline" className="text-[11px] text-accent hover:underline">← Pipeline</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Eyebrow>
              Module 05 · Diligence{s.sourceChannel ? ` · ${CHANNEL_SIGNAL[s.sourceChannel] ?? s.sourceChannel}` : ""}
            </Eyebrow>
            <h1 className="mt-1.5 text-[24px] font-bold tracking-tight">
              {s.company}
              {founderName ? <span className="text-muted"> · {founderName}</span> : null}
            </h1>
            <p className="mt-1 max-w-2xl text-[12.5px] text-muted">
              {s.oneLiner ?? "Every claim cross-checked against public evidence. Contradictions surface automatically."}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge tone={s.source === "outbound" ? "accent" : "neutral"}>
                {s.source}
                {s.sourceChannel ? `:${s.sourceChannel}` : ""}
              </Badge>
              {[s.sector, s.stage, s.geography].filter(Boolean).map((x) => (
                <Badge key={x as string}>{x}</Badge>
              ))}
              {isCold ? <Badge tone="warn">new founder</Badge> : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {s.decision ? (
              <div className="border border-ok/40 bg-okwash px-3 py-1.5 text-right">
                <div className="text-[12px] font-bold text-ok">
                  {s.decision === "invest" ? `✓ Deployed $${checkK}K` : s.decision === "watch" ? "◎ Watching" : "✕ Passed"}
                </div>
                {s.timeToDecisionMs != null ? (
                  <div className="tnum text-[10.5px] text-muted">
                    decided by {s.decidedBy ?? "human"} in {fmtDuration(s.timeToDecisionMs)}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 border border-bad/40 bg-badwash px-3 py-1.5">
                <span className="text-[11px] text-bad">⏱</span>
                <Countdown deadline={s.deadlineAt} className="text-[13px]" />
                <span className="text-[11px] text-bad">left</span>
              </div>
            )}
          </div>
        </div>

        {/* Score strip */}
        <div className="mt-4 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
          <StripCell label="Founder">
            {s.axes.founder ? (
              <span className={`tnum text-[24px] font-bold ${scoreTone(s.axes.founder.score)}`}>{s.axes.founder.score}</span>
            ) : (
              <span className="text-[13px] text-faint">—</span>
            )}
          </StripCell>
          <StripCell label="Market">
            {s.axes.market ? <TrendArrow trend={s.axes.market.trend} /> : <span className="text-[13px] text-faint">—</span>}
          </StripCell>
          <StripCell label="Idea vs market">
            {s.axes.idea_vs_market ? <TrendArrow trend={s.axes.idea_vs_market.trend} /> : <span className="text-[13px] text-faint">—</span>}
          </StripCell>
          <StripCell label="Contradictions">
            <span className={`tnum text-[24px] font-bold ${contradictions.length > 0 ? "text-bad" : "text-ok"}`}>
              {contradictions.length}
            </span>
          </StripCell>
        </div>
      </div>

      <div className="grid gap-6 px-6 py-6 md:px-8 xl:grid-cols-[1fr_290px]">
        <div className="min-w-0">
          {/* Pipeline runner */}
          <section className="u-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] uppercase tracking-wide">
                <StageChip label="Screen" state={screened} note={s.screenResult ?? undefined} />
                <span className="text-faint">→</span>
                {isCold ? (
                  <>
                    <StageChip label="Check" state={stages.footprint ?? (footprintSignal ? "done" : "idle")} />
                    <span className="text-faint">→</span>
                  </>
                ) : null}
                <StageChip label="3-axis" state={stages.score ?? (s.axes.founder ? "done" : "idle")} />
                <span className="text-faint">→</span>
                <StageChip label="Memo" state={stages.memo ?? (memo ? "done" : "idle")} />
                <span className="text-faint">→</span>
                <StageChip label="Verify" state={stages.verify ?? (claims.some((c) => c.externalVerification !== "na") ? "done" : "idle")} />
                <span className="text-faint">→</span>
                <StageChip label="Decide" state={s.decision ? "done" : memo ? "ready" : "idle"} note={s.decision ?? undefined} />
              </div>
              <div className="flex gap-2">
                {s.source === "outbound" && !s.decision ? (
                  <GhostButton onClick={draftOutreach} disabled={running}>⚡ Draft outreach</GhostButton>
                ) : null}
                {!s.decision ? (
                  rejected ? (
                    <PrimaryButton tone="ink" onClick={() => runDiligence({ force: true })} disabled={running}>
                      {running ? "Running…" : "Override gate → full diligence"}
                    </PrimaryButton>
                  ) : (
                    <PrimaryButton onClick={() => runDiligence()} disabled={running}>
                      {running ? "Running…" : "▶ Run full diligence"}
                    </PrimaryButton>
                  )
                ) : null}
              </div>
            </div>
            {rejected ? (
              <p className="mt-2.5 border border-bad/30 bg-badwash px-3 py-2 text-[12px] text-bad">
                Screened out: {s.screenReason ?? "clear non-fit"} — full analysis is gated until you override.
              </p>
            ) : null}
            {err ? <p className="mt-2.5 text-[12px] text-bad">{err}</p> : null}
            {outreach ? (
              <div className="mt-3 border border-ok/40 bg-okwash p-3">
                <div className="mb-1 text-[10.5px] uppercase tracking-wide text-ok">
                  Draft outreach — not sent · activation triggers an application, not an investment
                </div>
                <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed">{outreach}</p>
              </div>
            ) : null}
          </section>

          {/* Cold-start predictor */}
          {predictor ? (
            <section className="mt-5 border border-dashed border-accent/60 bg-card p-4">
              <div className="flex items-center justify-between">
                <Eyebrow>Background check · public footprint</Eyebrow>
                <Badge tone={predictor.verdict === "promising" ? "ok" : predictor.verdict === "weak" ? "bad" : "warn"}>
                  {predictor.verdict.replace("_", " ")}
                </Badge>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["Discourse quality", predictor.discourseQuality],
                    ["Community depth", predictor.communityDepth],
                    ["Domain consistency", predictor.domainConsistency],
                  ] as const
                ).map(([label, v]) => (
                  <div key={label} className="border border-line bg-paper p-3">
                    <div className="text-[10.5px] uppercase tracking-wide text-muted">{label}</div>
                    <div className={`tnum mt-1 text-[22px] font-bold ${scoreTone(v)}`}>{v}</div>
                    <div className="mt-1 h-1 bg-line">
                      <div className={`h-full ${v >= 60 ? "bg-ok" : v >= 40 ? "bg-warn" : "bg-bad"}`} style={{ width: `${v}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <ul className="mt-3 space-y-1">
                {predictor.indicators.map((x, i) => (
                  <li key={i} className="flex gap-2 text-[12px] text-muted">
                    <span className="text-ok">·</span>
                    {x}
                  </li>
                ))}
                {predictor.gaps.map((x, i) => (
                  <li key={i} className="flex gap-2 text-[12px] text-faint">
                    <span className="text-warn">·</span>
                    {x} <span className="text-[10.5px]">(gap — stated, not guessed)</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11.5px] text-faint">
                confidence {Math.round(predictor.confidence * 100)}% — this feeds the Founder score as evidence; it never replaces judgment.
              </p>
            </section>
          ) : isCold && !s.decision ? (
            <section className="mt-5 flex flex-wrap items-center justify-between gap-3 border border-dashed border-warn/60 bg-card p-4">
              <div>
                <Eyebrow className="!text-warn">New founder · background check not run yet</Eyebrow>
                <p className="mt-1 max-w-lg text-[12.5px] text-muted">
                  No track record on file — exactly who this fund exists to find. Check their public footprint
                  (what they write, where they participate, how long they've been at it) before judging.
                </p>
              </div>
              <GhostButton onClick={runFootprint} disabled={running}>
                {stages.footprint === "running" ? "Checking…" : "◎ Run background check"}
              </GhostButton>
            </section>
          ) : null}

          {/* 3-axis */}
          <section className="mt-5" id="diligence">
            <div className="mb-2 text-[10.5px] uppercase tracking-wide text-muted">
              3-axis screening · scored independently, never averaged
            </div>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {(["founder", "market", "idea_vs_market"] as (keyof AxisTriple)[]).map((k) => (
                <AxisCard key={k} axisKey={k} data={s.axes[k]} />
              ))}
            </div>
          </section>

          {/* Memo */}
          {memo ? (
            <section className="mt-6 u-card" id="memo">
              <div className="border-b border-line px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Eyebrow>Investment memo · v1 · auto-drafted</Eyebrow>
                  <Badge tone={memo.recommendation === "invest" ? "ok" : memo.recommendation === "watch" ? "warn" : "bad"}>
                    recommends {memo.recommendation === "invest" ? "deploy" : memo.recommendation}
                  </Badge>
                </div>
                <h2 className="mt-2 text-[20px] font-bold">{s.company}</h2>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  {[founderName, s.geography, s.stage, `$${checkK}K for ${ownPct}%`].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="space-y-5 px-5 py-5">
                <MemoBlock title="TL;DR" body={memo.summary} />
                <MemoBlock title="Company snapshot" body={sections.companySnapshot} warnings={claimsBySection(["company", "snapshot"])} />
                <MemoList title="Investment hypotheses" items={sections.investmentHypotheses} warnings={claimsBySection(["hypothes"])} />
                {sections.swot ? (
                  <div>
                    <MemoTitle>SWOT</MemoTitle>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <Quad title="Strengths" tone="ok" items={sections.swot.strengths} />
                      <Quad title="Weaknesses" tone="bad" items={sections.swot.weaknesses} />
                      <Quad title="Opportunities" tone="accent" items={sections.swot.opportunities} />
                      <Quad title="Risks" tone="warn" items={sections.swot.risks} />
                    </div>
                  </div>
                ) : null}
                <MemoBlock title="Problem & product" body={sections.problemProduct} warnings={claimsBySection(["problem", "product"])} />
                <MemoBlock title="Traction & KPIs" body={sections.tractionKpis} warnings={claimsBySection(["traction", "kpi", "revenue", "team", "market"])} />
                <div>
                  <MemoTitle>Deal terms</MemoTitle>
                  <p className="mt-1 text-[13px] text-muted">
                    ${checkK}K SAFE · target {ownPct}% · standard pro-rata. Derived from the committed thesis — not negotiated.
                  </p>
                </div>
                {sections.gaps && sections.gaps.length ? (
                  <div className="border border-warn/40 bg-warnwash p-3">
                    <div className="text-[10.5px] uppercase tracking-wide text-warn">Flagged gaps — stated, never fabricated</div>
                    <ul className="mt-1.5 space-y-1">
                      {sections.gaps.map((g, i) => (
                        <li key={i} className="text-[12.5px] text-muted">· {g}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* Claims & Trust */}
          {claims.length ? (
            <section className="mt-6">
              <div className="mb-2 text-[10.5px] uppercase tracking-wide text-muted">
                Validated evidence · per-claim Trust Score + external verification
              </div>
              <div className="grid gap-2">
                {claims.map((c) => (
                  <ClaimRow key={c.id} c={c} evidence={c.evidenceSignalIds.map(sig).filter(Boolean) as Signal[]} />
                ))}
              </div>
            </section>
          ) : null}

          {/* Trace */}
          {d.reasoningSteps.length ? (
            <section className="mt-6 u-card">
              <div className="border-b border-line px-4 py-2.5 text-[10.5px] uppercase tracking-wide text-muted">
                Agent reasoning trace · every conclusion cites its evidence
              </div>
              <div className="space-y-1.5 px-4 py-3">
                {d.reasoningSteps.map((st) => (
                  <TraceLine
                    key={st.id}
                    at={st.createdAt}
                    agent={`${st.agent}Agent`}
                    text={`${st.outputSummary ?? ""}${st.citedSignalIds.length ? ` · cited ${st.citedSignalIds.length} signal(s)` : ""}`}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {/* Founders */}
          <section className="mt-6">
            <div className="mb-2 text-[10.5px] uppercase tracking-wide text-muted">
              Founders · persistent Founder Score (never resets)
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {s.founders.map((f) => {
                const h = histories[f.id];
                return (
                  <div key={f.id} className="u-card p-4">
                    <div className="flex items-center justify-between">
                      <Link href={`/founder/${f.id}`} className="text-[13px] font-semibold hover:text-accent">
                        {f.name} {f.isColdStart ? <Badge tone="warn">new founder</Badge> : null}{" "}
                        <span className="font-normal text-faint">→ profile</span>
                      </Link>
                      <ScorePill n={h?.score ?? f.founderScore} label="FS" />
                    </div>
                    {h && h.history.length ? (
                      <div className="mt-2.5 space-y-1">
                        {h.history.slice(0, 5).map((e) => (
                          <div key={e.id} className="flex items-baseline gap-2 text-[11px] text-muted">
                            <span className={`tnum ${e.delta > 0 ? "text-ok" : e.delta < 0 ? "text-bad" : "text-faint"}`}>
                              {e.delta >= 0 ? "+" : ""}
                              {e.delta}
                            </span>
                            <span className="tnum">{e.score}</span>
                            <span className="truncate text-faint">· {e.reason}</span>
                          </div>
                        ))}
                        <div className="pt-1 text-[10.5px] text-faint">Score follows the person across ventures — never resets.</div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Signals */}
          <section className="mt-6">
            <div className="mb-2 text-[10.5px] uppercase tracking-wide text-muted">
              Memory · signals ({signals.length}) — timestamped, source-tagged, deduped
            </div>
            <div className="grid gap-2">
              {signals.map((sg) => (
                <div key={sg.id} className="u-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{sg.sourceType}</Badge>
                    {sg.title ? <span className="text-[12px] font-semibold">{sg.title}</span> : null}
                    {sg.sourceUrl ? (
                      <a href={sg.sourceUrl} target="_blank" rel="noreferrer" className="text-[11px] text-accent hover:underline">
                        Source ↗
                      </a>
                    ) : null}
                  </div>
                  <p className="mt-1.5 line-clamp-3 text-[12px] leading-relaxed text-muted">{sg.rawText}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right rail */}
        <aside className="flex h-fit flex-col gap-4 xl:sticky xl:top-4">
          {/* Axis scores */}
          <div className="u-card p-4">
            <div className="text-[10.5px] uppercase tracking-wide text-muted">Axis scores</div>
            <div className="mt-3 space-y-2.5">
              {(
                [
                  ["Founder", s.axes.founder?.score],
                  ["Market", s.axes.market?.score],
                  ["Idea", s.axes.idea_vs_market?.score],
                ] as const
              ).map(([label, v]) => (
                <div key={label}>
                  <div className="flex justify-between text-[11.5px]">
                    <span>{label}</span>
                    <span className={`tnum font-bold ${v != null ? scoreTone(v) : "text-faint"}`}>{v ?? "—"}</span>
                  </div>
                  <div className="mt-1 h-1 bg-line">
                    {v != null ? <div className={`h-full ${v >= 80 ? "bg-ok" : v >= 60 ? "bg-ink" : "bg-bad"}`} style={{ width: `${v}%` }} /> : null}
                  </div>
                </div>
              ))}
              {medianClaimTrust != null ? (
                <div>
                  <div className="flex justify-between text-[11.5px]">
                    <span title="Trust Score is per-claim; this is only the median rollup">Claim trust · median</span>
                    <span className={`tnum font-bold ${scoreTone(medianClaimTrust)}`}>{medianClaimTrust}</span>
                  </div>
                  <div className="mt-1 h-1 bg-line">
                    <div className={`h-full ${medianClaimTrust >= 80 ? "bg-ok" : "bg-warn"}`} style={{ width: `${medianClaimTrust}%` }} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Decision */}
          <div className={`border p-4 ${s.decision ? "border-line bg-card" : "border-accent bg-card"}`}>
            <div className={`text-[10.5px] uppercase tracking-wide ${s.decision ? "text-muted" : "text-accent"}`}>
              Your decision
            </div>
            {s.decision ? (
              <div className="mt-3">
                <div className="text-[14px] font-bold">
                  {s.decision === "invest" ? `✓ Deployed $${checkK}K` : s.decision === "watch" ? "◎ Watching" : "✕ Passed"}
                </div>
                {s.decisionNote ? <p className="mt-1.5 text-[12px] text-muted">“{s.decisionNote}”</p> : null}
                {s.timeToDecisionMs != null ? (
                  <p className="tnum mt-1.5 text-[11px] text-faint">
                    first signal → decision: {fmtDuration(s.timeToDecisionMs)}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                <button
                  onClick={() => decide("invest")}
                  disabled={deciding || !memo}
                  className="bg-ok px-3 py-2.5 text-[12px] font-bold uppercase tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  ✓ Deploy ${checkK}K
                </button>
                <button
                  onClick={() => decide("watch")}
                  disabled={deciding || !memo}
                  className="border border-line bg-paper px-3 py-2 text-[11.5px] uppercase tracking-wide text-muted hover:text-ink disabled:opacity-40"
                >
                  ◎ Watch — track in Memory
                </button>
                <button
                  onClick={extendClock}
                  disabled={deciding}
                  className="border border-line bg-paper px-3 py-2 text-[11.5px] uppercase tracking-wide text-muted hover:text-ink disabled:opacity-40"
                >
                  ⏱ Extend clock 24h
                </button>
                <button
                  onClick={() => decide("pass")}
                  disabled={deciding}
                  className="border border-bad/40 bg-badwash px-3 py-2 text-[11.5px] uppercase tracking-wide text-bad hover:opacity-90 disabled:opacity-40"
                >
                  ✕ Reject with feedback
                </button>
                {!memo ? (
                  <p className="text-[10.5px] text-faint">Deploy unlocks once the memo is drafted — the system never decides for you.</p>
                ) : null}
              </div>
            )}
          </div>

          <a href="#diligence" className="u-card px-4 py-2.5 text-center text-[11px] uppercase tracking-wide text-muted hover:text-ink">
            ← Review diligence
          </a>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------- sub-pieces -------------------------------- */
function StripCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="text-[10.5px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1.5 flex items-center">{children}</div>
    </div>
  );
}

function StageChip({ label, state, note }: { label: string; state: string; note?: string }) {
  const cls: Record<string, string> = {
    idle: "border-line text-faint",
    ready: "border-accent text-accent",
    running: "border-accent bg-wash text-accent",
    done: "border-ok/50 bg-okwash text-ok",
    error: "border-bad/50 bg-badwash text-bad",
  };
  const mark = state === "running" ? "◌" : state === "done" ? "✓" : state === "error" ? "✕" : state === "ready" ? "◉" : "○";
  return (
    <span className={`inline-flex items-center gap-1 border px-2 py-0.5 ${cls[state] ?? cls.idle}`}>
      {mark} {label}
      {note ? `: ${note}` : ""}
    </span>
  );
}

function MemoTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-bold uppercase tracking-wide text-accent">{children}</h3>;
}

function WarningCallouts({ warnings }: { warnings?: { id: string; contradictionNote: string | null; claimText: string }[] }) {
  if (!warnings?.length) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {warnings.map((w) => (
        <div key={w.id} className="border border-warn/50 bg-warnwash px-3 py-2 text-[11.5px] text-warn">
          ⚠ {w.contradictionNote ?? `Contradicted: ${w.claimText}`}
        </div>
      ))}
    </div>
  );
}

function MemoBlock({
  title,
  body,
  warnings,
}: {
  title: string;
  body?: string;
  warnings?: { id: string; contradictionNote: string | null; claimText: string }[];
}) {
  if (!body) return null;
  return (
    <div>
      <MemoTitle>{title}</MemoTitle>
      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed">{body}</p>
      <WarningCallouts warnings={warnings} />
    </div>
  );
}

function MemoList({
  title,
  items,
  warnings,
}: {
  title: string;
  items?: string[];
  warnings?: { id: string; contradictionNote: string | null; claimText: string }[];
}) {
  if (!items || !items.length) return null;
  return (
    <div>
      <MemoTitle>{title}</MemoTitle>
      <ul className="mt-1 space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-[13px] leading-relaxed">· {it}</li>
        ))}
      </ul>
      <WarningCallouts warnings={warnings} />
    </div>
  );
}

function Quad({ title, items, tone }: { title: string; items?: string[]; tone: "ok" | "bad" | "accent" | "warn" }) {
  const border: Record<string, string> = {
    ok: "border-ok/30",
    bad: "border-bad/30",
    accent: "border-accent/30",
    warn: "border-warn/30",
  };
  return (
    <div className={`border ${border[tone]} bg-paper p-3`}>
      <div className="text-[10.5px] font-bold uppercase tracking-wide">{title}</div>
      <ul className="mt-1.5 space-y-1">
        {(items ?? []).map((it, i) => (
          <li key={i} className="text-[12px] leading-snug text-muted">· {it}</li>
        ))}
      </ul>
    </div>
  );
}

function ClaimRow({ c, evidence }: { c: Claim; evidence: Signal[] }) {
  const [open, setOpen] = useState(false);
  const contradicted = c.externalVerification === "contradicted";
  const corroborated = c.externalVerification === "corroborated";
  return (
    <div className={`border p-3 ${contradicted ? "border-bad/40 bg-badwash" : "border-line bg-card"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 gap-2">
          <span className={`mt-0.5 text-[13px] ${contradicted ? "text-bad" : corroborated ? "text-ok" : "text-faint"}`}>
            {contradicted ? "⚠" : corroborated ? "✓" : "•"}
          </span>
          <div className="min-w-0">
            <div className="text-[10.5px] uppercase tracking-wide text-faint">{c.section}</div>
            <p className="text-[13px]">{c.claimText}</p>
            {c.contradictionNote ? <p className="mt-1 text-[11.5px] text-bad">⚠ {c.contradictionNote}</p> : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <TrustBadge trustLevel={c.trustLevel} verification={c.externalVerification} />
          <span className="tnum text-[10.5px] text-faint">conf {Math.round(c.confidence * 100)}%</span>
        </div>
      </div>
      {evidence.length ? (
        <button onClick={() => setOpen((v) => !v)} className="mt-1.5 text-[11px] text-accent hover:underline">
          {open ? "hide" : "show"} evidence ({evidence.length})
        </button>
      ) : (
        <span className="mt-1.5 block text-[10.5px] text-faint">no linked evidence</span>
      )}
      {open ? (
        <div className="mt-2 space-y-1.5 border-t border-line pt-2">
          {evidence.map((e) => (
            <div key={e.id} className="flex flex-wrap items-baseline gap-1.5 text-[11.5px] text-muted">
              <Badge>{e.sourceType}</Badge>
              <span className="font-semibold">{e.title}</span>
              <span className="text-faint">{(e.rawText ?? "").slice(0, 160)}</span>
              {e.sourceUrl ? (
                <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  Source ↗
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
