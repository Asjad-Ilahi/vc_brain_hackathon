"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, fmtAgo } from "../_components/api";
import { Badge, Countdown, Spinner } from "../_components/ui";
import { PageHeader } from "../_components/shared";

type MemoRow = {
  id: string;
  opportunityId: string;
  company: string;
  oneLiner: string | null;
  summary: string;
  recommendation: string | null;
  decision: string | null;
  decidedAt: string | null;
  deadlineAt: string | null;
  createdAt: string;
};

export default function MemosPage() {
  const [rows, setRows] = useState<MemoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<MemoRow[]>("/api/memos")
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Module 06 · Memos"
        title="Investment memos."
        sub="Auto-drafted from diligence. Every claim linked to evidence. The recommendation is the system's — the decision is yours."
      />
      <div className="space-y-4">
        {loading ? (
          <div className="py-20 text-center"><Spinner label="Loading memos…" /></div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-linestrong py-16 text-center text-[13px] text-faint">
            No memos yet — run diligence on a pipeline deal.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((m) => (
              <Link key={m.id} href={`/opportunity/${m.opportunityId}`} className="group bg-white border border-[#eceef3] rounded-[24px] p-6 shadow-none transition-colors hover:border-[#0045FF]/40">
                <div className="flex items-baseline justify-between gap-2 border-b border-[#eceef3] pb-3 mb-3">
                  <span className="truncate text-[15px] font-bold text-ink group-hover:text-[#0045FF]">{m.company}</span>
                  <span className="shrink-0 text-[10.5px] text-faint">{fmtAgo(m.createdAt)}</span>
                </div>
                {m.oneLiner ? <p className="mt-0.5 truncate text-[11.5px] text-muted font-sans font-medium">{m.oneLiner}</p> : null}
                <p className="mt-2 line-clamp-3 text-[12.5px] leading-relaxed text-muted font-sans">{m.summary}</p>
                <div className="mt-4 flex flex-wrap items-center gap-1.5 pt-1">
                  {m.recommendation ? (
                    <Badge tone={m.recommendation === "invest" ? "ok" : m.recommendation === "watch" ? "warn" : "bad"}>
                      recommends {m.recommendation === "invest" ? "deploy" : m.recommendation}
                    </Badge>
                  ) : null}
                  {m.decision ? (
                    <Badge tone={m.decision === "invest" ? "ok" : m.decision === "watch" ? "warn" : "bad"}>
                      ✓ decided: {m.decision === "invest" ? "deployed" : m.decision}
                    </Badge>
                  ) : (
                    <>
                      <Badge tone="accent">awaiting your decision</Badge>
                      <Countdown deadline={m.deadlineAt} />
                    </>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
