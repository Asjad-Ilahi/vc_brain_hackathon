"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../_components/api";
import { Spinner } from "../_components/ui";
import { PageHeader } from "../_components/shared";

type Activity = {
  id: string;
  agent: string;
  inputSummary: string | null;
  outputSummary: string | null;
  createdAt: string;
  opportunityId: string;
  company: string;
};

const AGENT_TONE: Record<string, string> = {
  screener: "bg-[#EBF0FF] text-[#0045FF]",
  scorer: "bg-[#EBF0FF] text-[#0045FF]",
  memo: "bg-[#E7F6EE] text-[#12A150]",
  validator: "bg-[#FDF2D8] text-[#B7791F]",
  footprint: "bg-[#F4F5F8] text-[#9E9E9E]",
  investor: "bg-[#E7F6EE] text-[#12A150]",
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
        sub="Every step the system takes is logged here · sourcing, screening, scoring, memo drafting and verification, newest first."
      />

      {loading ? (
        <div className="py-24 text-center"><Spinner label="Loading activity…" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#eceef3] py-16 text-center text-[13px] text-faint">
          No agent activity yet · run a search or full check on a deal.
        </div>
      ) : (
        <div className="bg-card rounded-[24px] p-6 border border-line space-y-3">
          {rows.map((a) => {
            const time = new Date(a.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
            const tone = AGENT_TONE[a.agent] ?? "bg-[#F4F5F8] text-[#9E9E9E]";
            return (
              <div
                key={a.id}
                className="flex items-start gap-4 bg-paper rounded-xl px-5 py-4 border border-line"
              >
                <span className={`shrink-0 px-2.5 py-1 text-[10px] font-bold uppercase rounded-full mt-0.5 ${tone}`}>
                  {a.agent}
                </span>
                <div className="min-w-0 flex-1 text-[13px] space-y-1">
                  <div className="font-bold text-ink flex items-center gap-2">
                    {a.company}
                    <span className="font-mono font-normal text-[10.5px] text-faint">
                      (ID: {a.opportunityId.slice(0, 8)}...)
                    </span>
                  </div>
                  {a.inputSummary ? (
                    <div className="font-mono text-[11.5px] text-muted leading-relaxed bg-[#fbfbfb] border border-[#f0f0f0] p-2 rounded">
                      <span className="font-semibold text-accent font-sans">Input:</span> {a.inputSummary}
                    </div>
                  ) : null}
                  <div className="text-muted leading-relaxed font-sans">
                    <span className="font-semibold text-ink">Output:</span> {a.outputSummary ?? "…"}
                  </div>
                </div>
                <span className="tnum shrink-0 text-[11.5px] text-faint mt-0.5">{time}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
