"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { OpportunitySummary } from "@/lib/services/list";
import { api } from "../_components/api";
import { Badge, Countdown, ScorePill, Spinner, TrendArrow } from "../_components/ui";
import { PageHeader } from "../_components/shared";

export default function DiligencePage() {
  const [opps, setOpps] = useState<OpportunitySummary[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div>
      <PageHeader
        eyebrow="Module 05 · Diligence"
        title="Deep-dive queue."
        sub="Every claim is checked against public evidence. Anything that doesn't add up gets flagged before it reaches you."
      />
      <div className="space-y-4">
        {loading ? (
          <div className="py-20 text-center"><Spinner label="Loading queue…" /></div>
        ) : queue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-linestrong py-16 text-center text-[13px] text-faint">
            Queue is clear — source founders on the Radar or take an application.
          </div>
        ) : (
          <div className="grid gap-2">
            {queue.map((o) => {
              const stage = o.status === "awaiting_decision" ? 4 : o.axes.founder ? 3 : o.screenResult ? 2 : 1;
              return (
                <Link
                  key={o.id}
                  href={`/opportunity/${o.id}`}
                  className="group flex flex-wrap items-center gap-x-4 gap-y-2 u-card px-4 py-3 transition-colors hover:border-linestrong"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-[13.5px] font-semibold group-hover:text-accent">{o.company}</span>
                      <span className="truncate text-[11.5px] text-faint">
                        {o.founders[0]?.name} · {o.sector ?? "—"}
                      </span>
                      {o.founders.some((f) => f.isColdStart) ? <Badge tone="warn">new founder</Badge> : null}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 text-[10.5px] uppercase tracking-wide text-faint">
                      <StageDot done={stage >= 2} label="screen" />
                      <span>→</span>
                      <StageDot done={stage >= 3} label="3-axis" />
                      <span>→</span>
                      <StageDot done={stage >= 4} label="memo" />
                      <span>→</span>
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
                    <span className="text-faint group-hover:text-accent">→</span>
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
    <span className={`flex items-center gap-1 ${done ? "text-ok" : active ? "text-accent" : ""}`}>
      <span>{done ? "✓" : active ? "◉" : "○"}</span>
      {label}
    </span>
  );
}
