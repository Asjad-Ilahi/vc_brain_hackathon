"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OpportunitySummary } from "@/lib/services/list";
import type { Thesis } from "@/lib/services/thesis";
import { api, fmtDuration } from "./api";
import { AxisCard, Badge, DecisionBadge, ScorePill, Spinner, ConvictionBadge } from "./ui";

type QueryResult = OpportunitySummary & { matchScore: number; matchReasons: string[] };
type ChannelStat = { name: string; found: number; scored: number; avgConviction: number; converted: number; quality: number };
type ChannelIntel = { channels: ChannelStat[]; suggestions: { channel: string; why: string }[] };

export default function Dashboard() {
  const router = useRouter();
  const [opps, setOpps] = useState<OpportunitySummary[]>([]);
  const [thesis, setThesis] = useState<Thesis | null>(null);
  const [channels, setChannels] = useState<ChannelIntel | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<"pipeline" | "radar">("pipeline");
  const [showApply, setShowApply] = useState(false);
  const [showThesis, setShowThesis] = useState(false);
  const [queryResults, setQueryResults] = useState<QueryResult[] | null>(null);
  const [queryParsed, setQueryParsed] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, t, c] = await Promise.all([
        api<OpportunitySummary[]>("/api/opportunities"),
        api<{ active: Thesis | null }>("/api/thesis"),
        api<ChannelIntel>("/api/channels").catch(() => ({ channels: [], suggestions: [] })),
      ]);
      setOpps(o);
      setThesis(t.active);
      setChannels(c);
    } catch (e) {
      setStatus(`Load failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runSource(kind: "github" | "web" | "hackernews" | "arxiv" | "all") {
    setBusy(kind === "all" ? "Scouting GitHub · Hacker News · arXiv · Web…" : `Sourcing from ${kind}…`);
    setStatus(null);
    try {
      if (kind === "all") {
        const r = await api<Record<string, number>>("/api/source/all", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        const total = Object.values(r).reduce((a, b) => a + b, 0);
        setStatus(`Scouted ${total} founders — GitHub ${r.github}, HN ${r.hackernews}, arXiv ${r.arxiv}, Web ${r.web}. Ranked on the Radar.`);
      } else {
        const r = await api<{ created: string[] }>(`/api/source/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        setStatus(`Sourced ${r.created.length} from ${kind}.`);
      }
      setView("radar");
      await load();
    } catch (e) {
      setStatus(`Sourcing failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  const scored = opps.filter((o) => o.axes.founder).length;
  const decided = opps.filter((o) => o.timeToDecisionMs != null);
  const avgTtd = decided.length ? decided.reduce((s, o) => s + (o.timeToDecisionMs ?? 0), 0) / decided.length : null;
  const inbound = opps.filter((o) => o.source === "inbound").length;

  const radar = opps
    .filter((o) => o.source === "outbound" && !o.decision)
    .sort((a, b) => (b.convictionScore ?? 0) - (a.convictionScore ?? 0));
  const highConviction = radar.filter((o) => (o.convictionScore ?? 0) >= 68).length;

  const shown = queryResults ?? opps;

  return (
    <div className="mx-auto max-w-6xl px-5 py-6">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            VC&nbsp;Brain <span className="text-indigo-400">·</span> <span className="text-slate-400 text-lg font-medium">Founder Intelligence</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">Discover founders before they raise → screen → 3-axis diligence → evidence-backed memo.</p>
          {thesis ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-500">Thesis:</span>
              <Badge tone="indigo">{thesis.name}</Badge>
              {thesis.sectors.slice(0, 4).map((s) => <Badge key={s}>{s}</Badge>)}
              {thesis.geographies.map((g) => <Badge key={g} tone="slate">{g}</Badge>)}
              <button onClick={() => setShowThesis(true)} className="ml-1 text-xs text-indigo-400 hover:underline">edit</button>
            </div>
          ) : (
            <button onClick={() => setShowThesis(true)} className="mt-3 text-sm text-indigo-400 hover:underline">+ Configure fund thesis</button>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <button onClick={() => setShowApply(true)} className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800">+ New application</button>
            <button disabled={!!busy} onClick={() => runSource("all")} className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50">⚡ Scout all sources</button>
          </div>
          <div className="inline-flex overflow-hidden rounded-md border border-slate-700 text-sm">
            <button onClick={() => setView("pipeline")} className={`px-3 py-1 ${view === "pipeline" ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800"}`}>Pipeline</button>
            <button onClick={() => setView("radar")} className={`px-3 py-1 ${view === "radar" ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800"}`}>
              Radar{highConviction > 0 ? <span className="ml-1 rounded-full bg-emerald-500/20 px-1.5 text-[10px] text-emerald-300">{highConviction}🔥</span> : null}
            </button>
          </div>
        </div>
      </header>

      {/* Metrics */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Opportunities" value={String(opps.length)} sub={`${inbound} inbound · ${opps.length - inbound} outbound`} />
        <Stat label="On the Radar" value={String(radar.length)} sub={`${highConviction} high-conviction`} />
        <Stat label="Scored (3-axis)" value={`${scored}/${opps.length}`} />
        <Stat label="Avg time to decision" value={fmtDuration(avgTtd)} sub="first signal → recommendation" />
      </div>

      {(busy || status) && (
        <div className="mt-4 rounded-md border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm">
          {busy ? <Spinner label={busy} /> : <span className="text-slate-300">{status}</span>}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center"><Spinner label="Loading…" /></div>
      ) : view === "radar" ? (
        <RadarView radar={radar} channels={channels} onSource={runSource} busy={!!busy} />
      ) : (
        <>
          {/* Query */}
          <QueryBar
            onResult={(res, parsed) => { setQueryResults(res); setQueryParsed(parsed); }}
            onClear={() => { setQueryResults(null); setQueryParsed(null); }}
            active={queryResults != null}
          />
          {queryParsed ? (
            <div className="mt-2 rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
              Parsed filter: <code className="text-slate-300">{JSON.stringify(queryParsed)}</code>
            </div>
          ) : null}
          <div className="mt-5 grid gap-3">
            {shown.length === 0 ? (
              <EmptyState onApply={() => setShowApply(true)} onScout={() => runSource("all")} />
            ) : (
              shown.map((o) => <OpportunityCard key={o.id} o={o} reasons={(o as QueryResult).matchReasons} />)
            )}
          </div>
        </>
      )}

      {showApply && <ApplyModal onClose={() => setShowApply(false)} onDone={(id) => { setShowApply(false); router.push(`/opportunity/${id}`); }} />}
      {showThesis && <ThesisModal current={thesis} onClose={() => setShowThesis(false)} onDone={() => { setShowThesis(false); load(); }} />}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-100">{value}</div>
      {sub ? <div className="text-[11px] text-slate-500">{sub}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------- Radar ------
function RadarView({ radar, channels, onSource, busy }: {
  radar: OpportunitySummary[];
  channels: ChannelIntel | null;
  onSource: (k: "github" | "web" | "hackernews" | "arxiv" | "all") => void;
  busy: boolean;
}) {
  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Sourcing Radar <span className="font-normal text-slate-600">· discovered before they applied, ranked by conviction</span></h2>
        </div>
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {(["github", "hackernews", "arxiv", "web"] as const).map((k) => (
            <button key={k} disabled={busy} onClick={() => onSource(k)} className="rounded border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800 disabled:opacity-50">+ {k}</button>
          ))}
        </div>
        {radar.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 py-14 text-center text-slate-500">
            No founders on the radar yet. Hit <span className="text-slate-300">⚡ Scout all sources</span>.
          </div>
        ) : (
          <div className="grid gap-2">
            {radar.map((o) => <RadarCard key={o.id} o={o} />)}
          </div>
        )}
      </div>
      <ChannelPanel channels={channels} onSource={onSource} busy={busy} />
    </div>
  );
}

function RadarCard({ o }: { o: OpportunitySummary }) {
  const founder = o.founders[0];
  return (
    <Link href={`/opportunity/${o.id}`} className="block rounded-lg border border-slate-800 bg-slate-900/40 p-3 transition hover:border-slate-600 hover:bg-slate-900/70">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ConvictionBadge score={o.convictionScore} />
            <span className="truncate font-semibold text-slate-100">{o.company}</span>
            <Badge tone="emerald">{o.sourceChannel}</Badge>
          </div>
          {o.oneLiner ? <p className="mt-1 line-clamp-1 text-sm text-slate-400">{o.oneLiner}</p> : null}
          <div className="mt-1 text-xs text-slate-500">
            {founder ? <>{founder.name} · </> : null}
            <span className="text-indigo-300">why now: {o.convictionReason ?? "—"}</span>
          </div>
        </div>
        <span className="shrink-0 text-[11px] text-slate-500">{o.status === "sourced" ? "→ assess" : o.status}</span>
      </div>
    </Link>
  );
}

function ChannelPanel({ channels, onSource, busy }: {
  channels: ChannelIntel | null;
  onSource: (k: "github" | "web" | "hackernews" | "arxiv" | "all") => void;
  busy: boolean;
}) {
  if (!channels) return null;
  const max = Math.max(1, ...channels.channels.map((c) => c.quality));
  return (
    <aside className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Channel intelligence</h3>
      <p className="mt-0.5 text-[11px] text-slate-600">Which channels yield quality (learns from outcomes)</p>
      <div className="mt-3 space-y-2">
        {channels.channels.length === 0 ? (
          <p className="text-xs text-slate-500">No channels used yet.</p>
        ) : channels.channels.map((c) => (
          <div key={c.name}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300">{c.name}</span>
              <span className="text-slate-500">q{c.quality} · {c.found} found</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(c.quality / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      {channels.suggestions.length ? (
        <div className="mt-4 border-t border-slate-800 pt-3">
          <div className="text-[11px] font-medium text-amber-300">Underexplored channels</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {channels.suggestions.map((s) => (
              <span key={s.channel} className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-200 ring-1 ring-amber-500/30">{s.channel}</span>
            ))}
          </div>
        </div>
      ) : null}
      <button disabled={busy} onClick={() => onSource("all")} className="mt-4 w-full rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50">⚡ Scout all sources</button>
    </aside>
  );
}

function OpportunityCard({ o, reasons }: { o: OpportunitySummary; reasons?: string[] }) {
  const topFounder = [...o.founders].sort((a, b) => b.founderScore - a.founderScore)[0];
  return (
    <Link href={`/opportunity/${o.id}`} className="block rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition hover:border-slate-600 hover:bg-slate-900/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-semibold text-slate-100">{o.company}</h3>
            <Badge tone={o.source === "inbound" ? "indigo" : "emerald"}>{o.source}{o.sourceChannel ? `:${o.sourceChannel}` : ""}</Badge>
            {o.source === "outbound" && o.convictionScore != null ? <ConvictionBadge score={o.convictionScore} /> : null}
            {o.founders.some((f) => f.isColdStart) ? <Badge tone="amber">cold-start</Badge> : null}
          </div>
          {o.oneLiner ? <p className="mt-0.5 line-clamp-1 text-sm text-slate-400">{o.oneLiner}</p> : null}
          <div className="mt-1 text-xs text-slate-500">
            {[o.sector, o.stage, o.geography].filter(Boolean).join(" · ")}
            {topFounder ? <> · {topFounder.name} <span className="text-slate-400">(FS {topFounder.founderScore})</span></> : null}
          </div>
          {reasons && reasons.length ? <div className="mt-1 text-[11px] text-indigo-300">matched: {reasons.join(", ")}</div> : null}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <DecisionBadge decision={o.decision} />
          {o.timeToDecisionMs != null ? <span className="text-[11px] text-slate-500">⏱ {fmtDuration(o.timeToDecisionMs)}</span> : <Badge tone="slate">{o.status}</Badge>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {o.axes.founder ? <ScorePill n={o.axes.founder.score} label="founder" /> : <Badge tone="slate">unscored</Badge>}
        {o.axes.market ? <ScorePill n={o.axes.market.score} label="market" /> : null}
        {o.axes.idea_vs_market ? <ScorePill n={o.axes.idea_vs_market.score} label="idea/mkt" /> : null}
        {!o.axes.founder ? <span className="text-xs text-slate-500">→ open to run 3-axis scoring</span> : null}
      </div>
    </Link>
  );
}

function EmptyState({ onApply, onScout }: { onApply: () => void; onScout: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 py-16 text-center">
      <p className="text-slate-400">No opportunities yet.</p>
      <p className="mt-1 text-sm text-slate-500">Scout founders from the open web, or add an application.</p>
      <div className="mt-4 flex justify-center gap-2">
        <button onClick={onScout} className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400">⚡ Scout all sources</button>
        <button onClick={onApply} className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">+ New application</button>
      </div>
    </div>
  );
}

function QueryBar({ onResult, onClear, active }: { onResult: (r: QueryResult[], parsed: unknown) => void; onClear: () => void; active: boolean }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function run() {
    if (!q.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await api<{ parsed: unknown; results: QueryResult[] }>("/api/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q }) });
      onResult(r.results, r.parsed);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="mt-5">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder='Ask: "technical founder, EU, AI infra, no prior VC backing"'
          className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
        />
        <button onClick={run} disabled={loading} className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white disabled:opacity-50">
          {loading ? "Searching…" : "Search"}
        </button>
        {active ? <button onClick={() => { setQ(""); onClear(); }} className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">Clear</button> : null}
      </div>
      {err ? <p className="mt-1 text-xs text-rose-400">{err}</p> : null}
    </div>
  );
}

function ApplyModal({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const [companyName, setCompanyName] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!companyName && !text && !file) { setErr("Add a company name and a deck (file or pasted text)."); return; }
    setLoading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.set("companyName", companyName);
      if (text) fd.set("text", text);
      if (file) fd.set("deck", file);
      const r = await api<{ opportunityId: string }>("/api/apply", { method: "POST", body: fd });
      onDone(r.opportunityId);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="New application — deck + company name" onClose={onClose}>
      <label className="block text-xs text-slate-400">Company name</label>
      <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm" placeholder="Acme AI" />
      <label className="mt-3 block text-xs text-slate-400">Deck (PDF or image)</label>
      <input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 w-full text-sm text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-slate-200" />
      <label className="mt-3 block text-xs text-slate-400">…or paste deck text</label>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm" placeholder="Problem, product, team, traction…" />
      {err ? <p className="mt-2 text-xs text-rose-400">{err}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300">Cancel</button>
        <button onClick={submit} disabled={loading} className="rounded-md bg-indigo-500 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          {loading ? "Parsing + screening…" : "Submit application"}
        </button>
      </div>
    </Modal>
  );
}

function ThesisModal({ current, onClose, onDone }: { current: Thesis | null; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(current?.name ?? "Pre-seed / seed AI infra (US + EU)");
  const [sectors, setSectors] = useState((current?.sectors ?? ["AI infrastructure", "developer tools"]).join(", "));
  const [stages, setStages] = useState((current?.stages ?? ["pre-seed", "seed"]).join(", "));
  const [geographies, setGeographies] = useState((current?.geographies ?? ["USA", "EU"]).join(", "));
  const [risk, setRisk] = useState(current?.riskAppetite ?? "high");
  const [notes, setNotes] = useState(current?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setLoading(true);
    setErr(null);
    try {
      await api("/api/thesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sectors: sectors.split(",").map((s) => s.trim()).filter(Boolean),
          stages: stages.split(",").map((s) => s.trim()).filter(Boolean),
          geographies: geographies.split(",").map((s) => s.trim()).filter(Boolean),
          riskAppetite: risk,
          notes,
        }),
      });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const field = "mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm";
  return (
    <Modal title="Fund thesis" onClose={onClose}>
      <label className="block text-xs text-slate-400">Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
      <label className="mt-3 block text-xs text-slate-400">Sectors (comma-separated)</label>
      <input value={sectors} onChange={(e) => setSectors(e.target.value)} className={field} />
      <label className="mt-3 block text-xs text-slate-400">Stages</label>
      <input value={stages} onChange={(e) => setStages(e.target.value)} className={field} />
      <label className="mt-3 block text-xs text-slate-400">Geographies</label>
      <input value={geographies} onChange={(e) => setGeographies(e.target.value)} className={field} />
      <label className="mt-3 block text-xs text-slate-400">Risk appetite</label>
      <select value={risk} onChange={(e) => setRisk(e.target.value)} className={field}>
        <option value="low">low</option>
        <option value="medium">medium</option>
        <option value="high">high</option>
      </select>
      <label className="mt-3 block text-xs text-slate-400">Notes</label>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
      {err ? <p className="mt-2 text-xs text-rose-400">{err}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300">Cancel</button>
        <button onClick={save} disabled={loading} className="rounded-md bg-indigo-500 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">{loading ? "Saving…" : "Save thesis"}</button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-16" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-950 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
