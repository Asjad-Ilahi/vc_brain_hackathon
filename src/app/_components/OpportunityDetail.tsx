"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { OpportunitySummary, AxisTriple } from "@/lib/services/list";
import { api, fmtDuration } from "./api";
import { AxisCard, Badge, DecisionBadge, ScorePill, Spinner, TrustBadge, TrendArrow } from "./ui";

type Signal = { id: string; sourceType: string; sourceUrl: string | null; title: string | null; rawText: string | null; tags: string[] };
type Claim = { id: string; section: string; claimText: string; evidenceSignalIds: string[]; confidence: number; trustLevel: string; externalVerification: string; contradictionNote: string | null };
type Step = { id: string; stepOrder: number; agent: string; inputSummary: string | null; outputSummary: string | null; citedSignalIds: string[] };
type Memo = { id: string; summary: string; recommendation: string | null; sectionsJson: Record<string, unknown> };
type Detail = { summary: OpportunitySummary; signals: Signal[]; memo: Memo | null; claims: Claim[]; reasoningSteps: Step[] };
type ScoreHistory = { id: string; score: number; delta: number; reason: string; milestone: string | null; createdAt: string };

export default function OpportunityDetail({ id }: { id: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<Record<string, "idle" | "running" | "done" | "error">>({});
  const [running, setRunning] = useState(false);
  const [outreach, setOutreach] = useState<string | null>(null);
  const [histories, setHistories] = useState<Record<string, { score: number; isColdStart: boolean; history: ScoreHistory[] }>>({});

  const load = useCallback(async () => {
    try {
      const detail = await api<Detail>(`/api/opportunities/${id}`);
      setD(detail);
      // load founder score histories
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

  useEffect(() => { load(); }, [load]);

  async function step(name: string, url: string) {
    setPipeline((p) => ({ ...p, [name]: "running" }));
    try {
      await api(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      setPipeline((p) => ({ ...p, [name]: "done" }));
      return true;
    } catch (e) {
      setPipeline((p) => ({ ...p, [name]: "error" }));
      setErr((e as Error).message);
      return false;
    }
  }

  async function runDiligence() {
    setRunning(true);
    setErr(null);
    // Converge: both inbound and outbound flow through the same screening step.
    let okStep = true;
    if (!d?.summary.screenResult) okStep = await step("screen", `/api/opportunities/${id}/screen`);
    if (okStep) okStep = await step("score", `/api/opportunities/${id}/score`);
    if (okStep) {
      const okMemo = await step("memo", `/api/opportunities/${id}/memo`);
      if (okMemo) await step("verify", `/api/opportunities/${id}/verify`);
    }
    await load();
    setRunning(false);
  }

  async function draftOutreach() {
    setRunning(true);
    try {
      const r = await api<{ draftMessage: string }>(`/api/opportunities/${id}/outreach`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      setOutreach(r.draftMessage);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-5xl px-5 py-16 text-center"><Spinner label="Loading opportunity…" /></div>;
  if (err && !d) return <div className="mx-auto max-w-5xl px-5 py-16"><p className="text-rose-400">{err}</p><Link href="/" className="text-indigo-400">← back</Link></div>;
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

  return (
    <div className="mx-auto max-w-5xl px-5 py-6">
      <Link href="/" className="text-sm text-indigo-400 hover:underline">← Pipeline</Link>

      {/* Header */}
      <header className="mt-3 flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{s.company}</h1>
            <Badge tone={s.source === "inbound" ? "indigo" : "emerald"}>{s.source}{s.sourceChannel ? `:${s.sourceChannel}` : ""}</Badge>
            {s.founders.some((f) => f.isColdStart) ? <Badge tone="amber">cold-start</Badge> : null}
          </div>
          {s.oneLiner ? <p className="mt-1 text-slate-400">{s.oneLiner}</p> : null}
          <p className="mt-1 text-xs text-slate-500">{[s.sector, s.stage, s.geography].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <DecisionBadge decision={s.decision} />
          <span className="text-xs text-slate-500">
            {s.timeToDecisionMs != null ? <>⏱ decided in {fmtDuration(s.timeToDecisionMs)}</> : `status: ${s.status}`}
          </span>
        </div>
      </header>

      {/* Pipeline */}
      <section className="mt-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StepChip label="Screen" state={pipeline.screen ?? (s.screenResult ? "done" : "idle")} note={s.screenResult ?? undefined} />
            <span className="text-slate-600">→</span>
            <StepChip label="3-axis score" state={pipeline.score ?? (s.axes.founder ? "done" : "idle")} />
            <span className="text-slate-600">→</span>
            <StepChip label="Memo" state={pipeline.memo ?? (memo ? "done" : "idle")} />
            <span className="text-slate-600">→</span>
            <StepChip label="Verify" state={pipeline.verify ?? (claims.some((c) => c.externalVerification !== "na") ? "done" : "idle")} />
          </div>
          <div className="flex gap-2">
            <button onClick={runDiligence} disabled={running} className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50">
              {running ? "Running…" : "▶ Run full diligence"}
            </button>
            {s.source === "outbound" ? (
              <button onClick={draftOutreach} disabled={running} className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50">Draft outreach</button>
            ) : null}
          </div>
        </div>
        {err ? <p className="mt-2 text-xs text-rose-400">{err}</p> : null}
        {outreach ? (
          <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="mb-1 text-xs font-medium text-emerald-300">Draft outreach (not sent — activation only)</div>
            <p className="whitespace-pre-wrap text-sm text-slate-200">{outreach}</p>
          </div>
        ) : null}
      </section>

      {/* 3-axis */}
      <section className="mt-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">3-Axis Screening <span className="font-normal text-slate-600">· scored independently, never averaged</span></h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["founder", "market", "idea_vs_market"] as (keyof AxisTriple)[]).map((k) => (
            <AxisCard key={k} axisKey={k} data={s.axes[k]} />
          ))}
        </div>
      </section>

      {/* Memo */}
      {memo ? (
        <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Investment memo</h2>
            <DecisionBadge decision={memo.recommendation} />
          </div>
          <p className="mt-2 text-slate-300">{memo.summary}</p>

          <MemoBlock title="Company snapshot" body={sections.companySnapshot} />
          <MemoList title="Investment hypotheses" items={sections.investmentHypotheses} />
          {sections.swot ? (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-300">SWOT</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Quad title="Strengths" tone="emerald" items={sections.swot.strengths} />
                <Quad title="Weaknesses" tone="rose" items={sections.swot.weaknesses} />
                <Quad title="Opportunities" tone="indigo" items={sections.swot.opportunities} />
                <Quad title="Risks" tone="amber" items={sections.swot.risks} />
              </div>
            </div>
          ) : null}
          <MemoBlock title="Problem & product" body={sections.problemProduct} />
          <MemoBlock title="Traction & KPIs" body={sections.tractionKpis} />
          {sections.gaps && sections.gaps.length ? (
            <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
              <h3 className="text-sm font-semibold text-amber-300">Flagged gaps (not fabricated)</h3>
              <ul className="mt-1 list-inside list-disc text-sm text-amber-200/90">
                {sections.gaps.map((g, i) => <li key={i}>{g}</li>)}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Claims & Trust */}
      {claims.length ? (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Claims & Trust Score <span className="font-normal text-slate-600">· per-claim evidence + external verification</span></h2>
          <div className="grid gap-2">
            {claims.map((c) => (
              <ClaimRow key={c.id} c={c} evidence={c.evidenceSignalIds.map(sig).filter(Boolean) as Signal[]} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Traceability */}
      {d.reasoningSteps.length ? (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Reasoning trace <span className="font-normal text-slate-600">· agentic traceability</span></h2>
          <ol className="relative ml-3 border-l border-slate-800">
            {d.reasoningSteps.map((st) => (
              <li key={st.id} className="mb-3 ml-4">
                <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-indigo-500" />
                <div className="text-sm"><span className="font-medium text-indigo-300">{st.agent}</span> <span className="text-slate-500">· step {st.stepOrder}</span></div>
                <div className="text-sm text-slate-300">{st.outputSummary}</div>
                {st.citedSignalIds.length ? <div className="text-[11px] text-slate-500">cited {st.citedSignalIds.length} signal(s)</div> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* Founders + Founder Score */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Founders · persistent Founder Score</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {s.founders.map((f) => {
            const h = histories[f.id];
            return (
              <div key={f.id} className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-slate-100">{f.name} {f.isColdStart ? <Badge tone="amber">cold-start</Badge> : null}</div>
                  <ScorePill n={h?.score ?? f.founderScore} label="FS" />
                </div>
                {h && h.history.length ? (
                  <div className="mt-2 space-y-1">
                    {h.history.slice(0, 5).map((e) => (
                      <div key={e.id} className="flex items-center gap-2 text-xs text-slate-400">
                        <span className={e.delta > 0 ? "text-emerald-400" : e.delta < 0 ? "text-rose-400" : "text-slate-500"}>{e.delta >= 0 ? "+" : ""}{e.delta}</span>
                        <span className="text-slate-300">{e.score}</span>
                        <span className="truncate">· {e.reason}</span>
                      </div>
                    ))}
                    <div className="text-[11px] text-slate-600">Score persists across applications — never resets.</div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* Memory / signals */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Memory · signals ({signals.length})</h2>
        <div className="grid gap-2">
          {signals.map((sg) => (
            <div key={sg.id} className="rounded-md border border-slate-800 bg-slate-900/30 p-3">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Badge tone="slate">{sg.sourceType}</Badge>
                {sg.title ? <span className="text-slate-300">{sg.title}</span> : null}
                {sg.sourceUrl ? <a href={sg.sourceUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">source ↗</a> : null}
              </div>
              <p className="mt-1 text-sm text-slate-300">{sg.rawText}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StepChip({ label, state, note }: { label: string; state: string; note?: string }) {
  const map: Record<string, string> = {
    idle: "border-slate-700 text-slate-400",
    running: "border-indigo-500 text-indigo-300",
    done: "border-emerald-500/50 text-emerald-300",
    error: "border-rose-500/50 text-rose-300",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${map[state] ?? map.idle}`}>
      {state === "running" ? "◌" : state === "done" ? "✓" : state === "error" ? "✕" : "○"} {label}{note ? `: ${note}` : ""}
    </span>
  );
}

function MemoBlock({ title, body }: { title: string; body?: string }) {
  if (!body) return null;
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300/90">{body}</p>
    </div>
  );
}

function MemoList({ title, items }: { title: string; items?: string[] }) {
  if (!items || !items.length) return null;
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
      <ul className="mt-1 list-inside list-disc text-sm text-slate-300/90">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}

function Quad({ title, items, tone }: { title: string; items?: string[]; tone: "emerald" | "rose" | "indigo" | "amber" }) {
  const border: Record<string, string> = { emerald: "border-emerald-500/20", rose: "border-rose-500/20", indigo: "border-indigo-500/20", amber: "border-amber-500/20" };
  return (
    <div className={`rounded-md border ${border[tone]} bg-slate-900/40 p-3`}>
      <div className="text-xs font-semibold text-slate-300">{title}</div>
      <ul className="mt-1 list-inside list-disc text-sm text-slate-400">
        {(items ?? []).map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}

function ClaimRow({ c, evidence }: { c: Claim; evidence: Signal[] }) {
  const [open, setOpen] = useState(false);
  const contradicted = c.externalVerification === "contradicted";
  return (
    <div className={`rounded-lg border p-3 ${contradicted ? "border-rose-500/40 bg-rose-500/5" : "border-slate-800 bg-slate-900/40"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">{c.section}</div>
          <p className="text-sm text-slate-200">{c.claimText}</p>
          {c.contradictionNote ? <p className="mt-1 text-xs text-rose-300">⚠ {c.contradictionNote}</p> : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          <TrustBadge trustLevel={c.trustLevel} verification={c.externalVerification} />
          <span className="text-[11px] text-slate-500">conf {Math.round(c.confidence * 100)}%</span>
        </div>
      </div>
      {evidence.length ? (
        <button onClick={() => setOpen((v) => !v)} className="mt-1 text-[11px] text-indigo-400 hover:underline">
          {open ? "hide" : "show"} evidence ({evidence.length})
        </button>
      ) : (
        <span className="mt-1 block text-[11px] text-slate-600">no linked evidence</span>
      )}
      {open ? (
        <div className="mt-2 space-y-1 border-t border-slate-800 pt-2">
          {evidence.map((e) => (
            <div key={e.id} className="text-xs text-slate-400">
              <Badge tone="slate">{e.sourceType}</Badge> {e.title} — <span className="text-slate-500">{(e.rawText ?? "").slice(0, 180)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
