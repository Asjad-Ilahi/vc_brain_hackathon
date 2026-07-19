"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { OpportunitySummary } from "@/lib/services/list";
import { api } from "../_components/api";
import { Badge, Countdown, ScorePill, Spinner, TrendArrow } from "../_components/ui";
import { PageHeader, ListSearch } from "../_components/shared";

export default function DiligencePage() {
  const [opps, setOpps] = useState<OpportunitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState("");

  useEffect(() => {
    api<OpportunitySummary[]>("/api/opportunities")
      .then(setOpps)
      .finally(() => setLoading(false));
  }, []);

  const queue = useMemo(
    () =>
      opps
        .filter((o) => !o.decision && o.screenResult !== "reject")
        .sort((a, b) => {
          const da = a.deadlineAt ? new Date(a.deadlineAt).getTime() : Infinity;
          const db = b.deadlineAt ? new Date(b.deadlineAt).getTime() : Infinity;
          return da - db;
        }),
    [opps]
  );

  const t = term.trim().toLowerCase();
  const shown = t
    ? queue.filter((o) => [o.company, o.founders[0]?.name, o.sector, o.oneLiner].filter(Boolean).join(" ").toLowerCase().includes(t))
    : queue;

  return (
    <div>
      <PageHeader
        eyebrow="Module 05 · Diligence"
        title="Deep-dive queue."
        sub="Every claim is checked against public evidence. Anything that doesn't add up gets flagged before it reaches you."
      />
      <div className="space-y-4">
        {!loading && queue.length > 0 ? (
          <ListSearch value={term} onChange={setTerm} placeholder="Search the queue by company, founder, or sector…" />
        ) : null}
        {loading ? (
          <div className="py-20 text-center"><Spinner label="Loading queue…" /></div>
        ) : queue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-linestrong py-16 text-center text-[13px] text-faint">
            Queue is clear — source founders on the Radar or take an application.
          </div>
        ) : shown.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-linestrong py-16 text-center text-[13px] text-faint">
            No deals in the queue match “{term}”.
          </div>
        ) : (
          <div className="bg-[#F8F8F8] rounded-[28px] p-6 border-0 shadow-none space-y-3">
            {shown.map((o) => {
              const stage = o.status === "awaiting_decision" ? 4 : o.axes.founder ? 3 : o.screenResult ? 2 : 1;
              return (
                <Link
                  key={o.id}
                  href={`/opportunity/${o.id}`}
                  className="group flex flex-wrap items-center gap-x-4 gap-y-2 bg-white rounded-full px-8 py-3.5 border border-[#eceef3] shadow-none hover:bg-slate-50 transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-[14px] font-bold text-ink group-hover:text-[#0045FF]">{o.company}</span>
                      <span className="truncate text-[11.5px] text-muted">
                        {o.founders[0]?.name} · {o.sector ?? "—"}
                      </span>
                      {o.founders.some((f) => f.isColdStart) ? <Badge tone="warn">new founder</Badge> : null}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#9E9E9E] font-medium font-sans">
                      <StageDot done={stage >= 2} label="screen" />
                      <span className="text-[#eceef3]">/</span>
                      <StageDot done={stage >= 3} label="3-axis" />
                      <span className="text-[#eceef3]">/</span>
                      <StageDot done={stage >= 4} label="memo" />
                      <span className="text-[#eceef3]">/</span>
                      <StageDot done={false} label="decide" active={stage >= 4} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {o.axes.founder ? (
                      <span className="flex items-center gap-1">
                        <ScorePill n={o.axes.founder.score} label="F" />
                        <TrendArrow trend={o.axes.founder.trend} />
                      </span>
                    ) : null}
                    {o.flags > 0 ? <Badge tone="warn">⚠ {o.flags}</Badge> : null}
                    {o.status === "awaiting_decision" ? <Badge tone="accent">memo ready</Badge> : null}
                    <Countdown deadline={o.deadlineAt} decided={!!o.decision} />
                    <span className="text-faint group-hover:text-[#0045FF]">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StageDot({ done, label, active }: { done: boolean; label: string; active?: boolean }) {
  return (
    <span className={`flex items-center gap-1 ${done ? "text-[#12A150]" : active ? "text-[#0045FF] font-bold" : "text-[#9E9E9E]"}`}>
      <span className="text-[12px]">{done ? "✓" : active ? "◉" : "○"}</span>
      {label}
    </span>
  );
}
