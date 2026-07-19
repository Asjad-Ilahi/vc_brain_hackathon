"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { OpportunitySummary } from "@/lib/services/list";
import { api, postJson } from "../_components/api";
import { Badge, Chip, Countdown, ScorePill, Spinner, TrendArrow, countdownParts, useNow, scoreTone } from "../_components/ui";
import { ApplyModal, GhostButton, ListSearch, PageHeader, initialsOf } from "../_components/shared";

type QueryResult = OpportunitySummary & { matchScore: number; matchReasons: string[] };

export default function PipelinePage() {
  return (
    <Suspense fallback={<div className="py-24 text-center"><Spinner label="Loading pipeline…" /></div>}>
      <Pipeline />
    </Suspense>
  );
}

function Pipeline() {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const now = useNow(15_000);

  const [opps, setOpps] = useState<OpportunitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryResults, setQueryResults] = useState<QueryResult[] | null>(null);
  const [parsed, setParsed] = useState<unknown>(null);
  const [querying, setQuerying] = useState(false);
  const [filter, setFilter] = useState<"all" | "under8" | "flagged" | "inbound" | "outbound" | "screened" | "pending" | "screened_out">("all");
  const [sort, setSort] = useState<"arrangement" | "countdown" | "score" | "sector">("arrangement");
  const [term, setTerm] = useState(""); // client-side filter over the loaded deals
  const [showApply, setShowApply] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const filterLabels: Record<string, string> = {
    all: "All Opportunities",
    under8: "Urgent (< 8h)",
    flagged: "Flagged",
    inbound: "Inbound (Applied)",
    outbound: "Outbound (Sourced)",
    screened: "Screened",
    pending: "Pending",
    screened_out: "Screened Out",
  };

  const sortLabels: Record<string, string> = {
    arrangement: "Arrangement",
    countdown: "Countdown ↑",
    score: "Score ↓",
    sector: "Sector",
  };

  const load = useCallback(async () => {
    try {
      setOpps(await api<OpportunitySummary[]>("/api/opportunities"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!q) {
      setQueryResults(null);
      setParsed(null);
      return;
    }
    setQuerying(true);
    postJson<{ parsed: unknown; results: QueryResult[] }>("/api/query", { q })
      .then((r) => {
        setQueryResults(r.results);
        setParsed(r.parsed);
      })
      .catch(() => setQueryResults([]))
      .finally(() => setQuerying(false));
  }, [q]);

  const getStageOrder = (o: OpportunitySummary) => {
    if (o.status === "awaiting_decision" || o.recommendation) return 0;
    if (o.screenResult === "reject") return 2;
    return 1;
  };

  const active = useMemo(() => {
    const base = (queryResults ?? opps).filter((o) => !o.decision);
    const t = term.trim().toLowerCase();
    const filtered = base
      .filter((o) => {
        if (filter === "under8") {
          const p = countdownParts(o.deadlineAt, now);
          return p && !p.expired && p.ms < 8 * 3600_000;
        }
        if (filter === "flagged") return o.flags > 0;
        if (filter === "inbound") return o.source === "inbound";
        if (filter === "outbound") return o.source === "outbound";
        if (filter === "screened") return o.screenResult === "pass";
        if (filter === "pending") return !o.screenResult;
        if (filter === "screened_out") return o.screenResult === "reject";
        return true;
      })
      .filter((o) => !t || [o.company, o.founders[0]?.name, o.sector, o.oneLiner].filter(Boolean).join(" ").toLowerCase().includes(t));
    if (queryResults) return filtered; // keep relevance order for query results
    return [...filtered].sort((a, b) => {
      if (sort === "arrangement") {
        const orderA = getStageOrder(a);
        const orderB = getStageOrder(b);
        if (orderA !== orderB) return orderA - orderB;
        const da = a.deadlineAt ? new Date(a.deadlineAt).getTime() : Infinity;
        const db = b.deadlineAt ? new Date(b.deadlineAt).getTime() : Infinity;
        return da - db;
      }
      if (sort === "countdown") {
        const da = a.deadlineAt ? new Date(a.deadlineAt).getTime() : Infinity;
        const db = b.deadlineAt ? new Date(b.deadlineAt).getTime() : Infinity;
        // Live clocks first (soonest deadline on top); elapsed clocks sink to
        // the bottom instead of permanently squatting above fresh urgent deals.
        const ea = da < now;
        const eb = db < now;
        if (ea !== eb) return ea ? 1 : -1;
        return da - db;
      }
      if (sort === "score") {
        return (b.axes.founder?.score ?? b.convictionScore ?? 0) - (a.axes.founder?.score ?? a.convictionScore ?? 0);
      }
      return (a.sector ?? "").localeCompare(b.sector ?? "");
    });
  }, [opps, queryResults, filter, sort, now, term]);

  const decidedRows = useMemo(() => opps.filter((o) => o.decision), [opps]);
  const under8 = opps.filter((o) => {
    if (o.decision) return false;
    const p = countdownParts(o.deadlineAt, now);
    return p && !p.expired && p.ms < 8 * 3600_000;
  }).length;
  const under4 = opps.filter((o) => {
    if (o.decision) return false;
    const p = countdownParts(o.deadlineAt, now);
    return p && !p.expired && p.urgent;
  }).length;
  const flagged = opps.filter((o) => !o.decision && o.flags > 0).length;
  const inboundN = opps.filter((o) => !o.decision && o.source === "inbound").length;
  const outboundN = opps.filter((o) => !o.decision && o.source === "outbound").length;
  const screenedN = opps.filter((o) => !o.decision && o.screenResult === "pass").length;
  const pendingN = opps.filter((o) => !o.decision && !o.screenResult).length;
  const screenedOutN = opps.filter((o) => !o.decision && o.screenResult === "reject").length;

  return (
    <div>
      <PageHeader
        eyebrow="Module 03 · Pipeline & screening"
        title={`${active.length} opportunit${active.length === 1 ? "y" : "ies"} on the clock.`}
        sub="Every deal gets three separate scores — Founder, Market, Idea — never blended into one number. Founder scores follow the person, not the company."
        right={
          <div className="flex flex-col items-end gap-2">
            <GhostButton onClick={() => setShowApply(true)}>+ New application</GhostButton>
            {under4 > 0 ? (
              <span className="flex items-center gap-1.5 border border-warn/40 bg-warnwash px-2.5 py-1 text-[11px] text-warn">
                ⏱ {under4} under 4h · action required
              </span>
            ) : null}
          </div>
        }
      />

      <div className="space-y-4">
        {/* NL query state */}
        {q ? (
          <div className="mb-4 border border-accent/40 bg-wash px-3.5 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] text-accent">
                {querying ? "Resolving query…" : `Query: "${q}" — ${queryResults?.length ?? 0} ranked matches`}
              </span>
              <button onClick={() => router.push("/pipeline")} className="text-[11px] text-muted hover:text-ink">
                ✕ Clear
              </button>
            </div>
            {parsed != null && (
              <div className="mt-1 truncate text-[10.5px] text-muted">
                parsed filter: {JSON.stringify(parsed)}
              </div>
            )}
          </div>
        ) : null}

        {/* Filter the deals already loaded */}
        {opps.length > 0 ? (
          <ListSearch value={term} onChange={setTerm} placeholder="Search these deals by company, founder, or sector…" />
        ) : null}

        {/* Filters + sort drop-downs */}
        <div className="flex flex-wrap items-center gap-3 relative z-30">
          {/* Filter Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => {
                setFilterOpen(!filterOpen);
                setSortOpen(false);
              }}
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-card border border-line rounded-lg hover:bg-paper hover:border-linestrong transition-all cursor-pointer"
            >
              <span>🔍 Filter: <strong className="text-[#0045FF]">{filterLabels[filter]}</strong></span>
              <span className="text-faint text-[9px] transition-transform duration-200">▼</span>
            </button>
            {filterOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
                <div className="absolute left-0 mt-1.5 w-60 bg-card border border-line rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
                  {(Object.keys(filterLabels) as Array<typeof filter>).map((key) => {
                    const active = filter === key;
                    const count =
                      key === "all" ? inboundN + outboundN :
                      key === "under8" ? under8 :
                      key === "flagged" ? flagged :
                      key === "inbound" ? inboundN :
                      key === "outbound" ? outboundN :
                      key === "screened" ? screenedN :
                      key === "pending" ? pendingN :
                      screenedOutN;
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          setFilter(key);
                          setFilterOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-4 py-2 text-[12.5px] text-left hover:bg-paper transition-all cursor-pointer ${
                          active ? "text-[#0045FF] font-bold bg-wash" : "text-muted font-medium"
                        }`}
                      >
                        <span>{filterLabels[key]}</span>
                        <span className="font-mono text-[11px] text-faint">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Sort Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => {
                setSortOpen(!sortOpen);
                setFilterOpen(false);
              }}
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-card border border-line rounded-lg hover:bg-paper hover:border-linestrong transition-all cursor-pointer"
            >
              <span>⇅ Sort: <strong className="text-[#0045FF]">{sortLabels[sort]}</strong></span>
              <span className="text-faint text-[9px]">▼</span>
            </button>
            {sortOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSortOpen(false)} />
                <div className="absolute left-0 mt-1.5 w-48 bg-card border border-line rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
                  {(Object.keys(sortLabels) as Array<typeof sort>).map((key) => {
                    const active = sort === key;
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          setSort(key);
                          setSortOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-4 py-2 text-[12.5px] text-left hover:bg-paper transition-all cursor-pointer ${
                          active ? "text-[#0045FF] font-bold bg-wash" : "text-muted font-medium"
                        }`}
                      >
                        <span>{sortLabels[key]}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="py-20 text-center"><Spinner label="Loading pipeline…" /></div>
        ) : (
          <div className="mt-4 overflow-x-auto bg-[#F8F8F8] rounded-[28px] p-6 shadow-none border-0">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#eceef3]">
                  <Th># Company · Founder</Th>
                  <Th>Founder score<br /><span className="font-normal normal-case text-faint">persists · memory layer</span></Th>
                  <Th>Founder axis<br /><span className="font-normal normal-case text-faint">traits + track record</span></Th>
                  <Th>Market axis<br /><span className="font-normal normal-case text-faint">TAM · competitors · SWOT</span></Th>
                  <Th>Idea vs market<br /><span className="font-normal normal-case text-faint">survives scrutiny?</span></Th>
                  <Th>Flags</Th>
                  <Th>Countdown</Th>
                </tr>
              </thead>
              <tbody>
                {active.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-[13px] text-faint">
                      Nothing in the pipeline{filter !== "all" ? " for this filter" : ""}.
                    </td>
                  </tr>
                ) : (
                  active.map((o, i) => <Row key={o.id} o={o} i={i} reasons={(o as QueryResult).matchReasons} />)
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Decided */}
        {decidedRows.length > 0 && !q ? (
          <div className="mt-6">
            <div className="text-[10.5px] uppercase tracking-wide text-muted font-bold mb-3 pl-2">
              Decided · {decidedRows.length}
            </div>
            <div className="bg-[#F8F8F8] rounded-[28px] p-6 border-0 shadow-none space-y-3">
              {decidedRows.map((o) => (
                <Link
                  key={o.id}
                  href={`/opportunity/${o.id}`}
                  className="flex items-center justify-between gap-3 bg-white rounded-full px-8 py-3.5 border border-[#eceef3] shadow-none hover:bg-slate-50 transition-all"
                >
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="truncate text-[13px] font-bold text-ink">{o.company}</span>
                    <span className="truncate text-[11.5px] text-muted">{o.founders[0]?.name}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={o.decision === "invest" ? "ok" : o.decision === "watch" ? "warn" : "bad"}>
                      {o.decision === "invest" ? "✓ deployed" : o.decision}
                    </Badge>
                    {o.timeToDecisionMs != null ? (
                      <span className="tnum text-[11px] text-faint">
                        decided in {Math.round(o.timeToDecisionMs / 60000)}m
                      </span>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {showApply && (
        <ApplyModal
          onClose={() => setShowApply(false)}
          onDone={(id) => {
            setShowApply(false);
            router.push(`/opportunity/${id}`);
          }}
        />
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-3.5 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted">
      {children}
    </th>
  );
}

function AxisCell({ data }: { data?: { score: number; trend: string; rationale: string } }) {
  if (!data) return <td className="px-3.5 py-3 text-[11px] text-faint">—</td>;
  return (
    <td className="px-3.5 py-3">
      <div className="flex items-center gap-2">
        <div className="flex shrink-0 items-center gap-1">
          <span className={`font-bold text-[13px] ${scoreTone(data.score)}`}>{data.score}</span>
          <TrendArrow trend={data.trend} />
        </div>
        <span className="line-clamp-2 max-w-[190px] text-[11.5px] leading-snug text-muted">{data.rationale}</span>
      </div>
    </td>
  );
}

function Row({ o, i, reasons }: { o: OpportunitySummary; i: number; reasons?: string[] }) {
  const f = o.founders[0];
  return (
    <tr className="group border-b border-line last:border-b-0 hover:bg-paper">
      <td className="px-3.5 py-3">
        <Link href={`/opportunity/${o.id}`} className="block">
          <div className="flex items-center gap-2.5">
            <span className="tnum text-[10.5px] text-faint">{String(i + 1).padStart(2, "0")}</span>
            <Badge tone={o.source === "outbound" ? "accent" : "neutral"}>
              {o.source === "outbound" ? "⚡ out" : "▸ in"}
            </Badge>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold group-hover:text-[#0045FF]">{o.company}</div>
              <div className="truncate text-[11px] text-faint">
                {f?.name ?? "—"} · {o.sector ?? "—"}
                {f?.isColdStart ? " · new founder" : ""}
              </div>
              {reasons?.length ? (
                <div className="mt-0.5 truncate text-[10.5px] text-[#0045FF]">matched: {reasons.join(", ")}</div>
              ) : null}
              {/* On narrow screens the countdown column scrolls off — surface it here. */}
              <div className="mt-0.5 flex items-center gap-1.5 lg:hidden">
                <Countdown deadline={o.deadlineAt} decided={!!o.decision} />
                {o.flags > 0 ? <Badge tone="warn">⚠ {o.flags}</Badge> : null}
              </div>
            </div>
          </div>
        </Link>
      </td>
      <td className="px-3.5 py-3">
        {f ? (
          <span className="flex items-center gap-1.5">
            <ScorePill n={f.founderScore} />
            <TrendArrow trend={o.axes.founder?.trend} />
          </span>
        ) : (
          "—"
        )}
      </td>
      <AxisCell data={o.axes.founder} />
      <AxisCell data={o.axes.market} />
      <AxisCell data={o.axes.idea_vs_market} />
      <td className="px-3.5 py-3">
        {o.flags > 0 ? <Badge tone="warn">⚠ {o.flags}</Badge> : <span className="text-[11px] text-faint">—</span>}
      </td>
      <td className="px-3.5 py-3">
        <Countdown deadline={o.deadlineAt} decided={!!o.decision} />
      </td>
    </tr>
  );
}
