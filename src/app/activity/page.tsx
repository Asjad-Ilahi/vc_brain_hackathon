"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../_components/api";
import { Spinner } from "../_components/ui";
import { PageHeader } from "../_components/shared";

type Activity = {
  id: string;
  agent: string;
  outputSummary: string | null;
  createdAt: string;
  opportunityId: string;
  company: string;
};

const AGENT_TONE: Record<string, string> = {
  screener: "bg-brandfaint text-brand",
  scorer: "bg-brandfaint text-brand",
  memo: "bg-okwash text-ok",
  validator: "bg-warnwash text-warn",
  footprint: "bg-panel text-muted",
  investor: "bg-okwash text-ok",
};

export default function ActivityPage() {
  const [rows, setRows] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => api<Activity[]>("/api/activity").then(setRows).catch(() => {}).finally(() => setLoading(false));
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Agent activity"
        title="What the agents are doing."
        sub="Every step the system takes is logged here — sourcing, screening, scoring, memo drafting and verification, newest first."
      />

      {loading ? (
        <div className="py-24 text-center"><Spinner label="Loading activity…" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-linestrong py-16 text-center text-[13px] text-faint">
          No agent activity yet — run a search or full check on a deal.
        </div>
      ) : (
        <div className="u-card p-2">
          {rows.map((a) => {
            const time = new Date(a.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
            const tone = AGENT_TONE[a.agent] ?? "bg-panel text-muted";
            return (
              <Link
                key={a.id}
                href={`/opportunity/${a.opportunityId}`}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-cardalt"
              >
                <span className={`u-pill shrink-0 px-2.5 py-1 text-[11px] font-bold uppercase ${tone}`}>{a.agent}</span>
                <span className="min-w-0 flex-1 text-[13px]">
                  <span className="font-semibold text-ink">{a.company}</span>
                  <span className="text-muted"> — {a.outputSummary ?? "…"}</span>
                </span>
                <span className="tnum shrink-0 text-[11.5px] text-faint">{time}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
