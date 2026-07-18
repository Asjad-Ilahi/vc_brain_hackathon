"use client";
import type { AxisTriple } from "@/lib/services/list";

export function TrendArrow({ trend }: { trend?: string }) {
  if (trend === "improving") return <span className="text-emerald-400" title="improving">▲</span>;
  if (trend === "declining") return <span className="text-rose-400" title="declining">▼</span>;
  return <span className="text-slate-500" title="stable">▬</span>;
}

function scoreColor(n: number) {
  if (n >= 70) return "text-emerald-300 bg-emerald-500/10 ring-emerald-500/30";
  if (n >= 50) return "text-amber-300 bg-amber-500/10 ring-amber-500/30";
  return "text-rose-300 bg-rose-500/10 ring-rose-500/30";
}

export function ScorePill({ n, label }: { n: number; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-semibold ring-1 ${scoreColor(n)}`}>
      {label ? <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">{label}</span> : null}
      {n}
    </span>
  );
}

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "indigo" | "emerald" | "rose" | "amber" }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
    indigo: "bg-indigo-500/10 text-indigo-300 ring-indigo-500/30",
    emerald: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    rose: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
  };
  return <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ${tones[tone]}`}>{children}</span>;
}

export function TrustBadge({ trustLevel, verification }: { trustLevel: string; verification: string }) {
  const t: Record<string, "emerald" | "amber" | "rose" | "slate"> = {
    high: "emerald",
    medium: "amber",
    low: "rose",
    unverified: "slate",
  };
  const vlabel: Record<string, string> = {
    corroborated: "✓ web-corroborated",
    contradicted: "⚠ contradicted",
    not_found: "web: not found",
    na: "not checked",
  };
  return (
    <span className="inline-flex items-center gap-1">
      <Badge tone={t[trustLevel] ?? "slate"}>trust: {trustLevel}</Badge>
      <Badge tone={verification === "contradicted" ? "rose" : verification === "corroborated" ? "emerald" : "slate"}>
        {vlabel[verification] ?? verification}
      </Badge>
    </span>
  );
}

export function DecisionBadge({ decision }: { decision: string | null }) {
  if (!decision) return <Badge tone="slate">no decision yet</Badge>;
  const tone = decision === "invest" ? "emerald" : decision === "watch" ? "amber" : "rose";
  return <Badge tone={tone}>recommend: {decision}</Badge>;
}

const AXIS_LABEL: Record<string, string> = {
  founder: "Founder",
  market: "Market",
  idea_vs_market: "Idea vs Market",
};

export function AxisCard({ axisKey, data }: { axisKey: keyof AxisTriple; data: AxisTriple[keyof AxisTriple] }) {
  if (!data) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 opacity-60">
        <div className="text-xs uppercase tracking-wide text-slate-400">{AXIS_LABEL[axisKey]}</div>
        <div className="mt-2 text-sm text-slate-500">Not scored yet</div>
      </div>
    );
  }
  const rating = (data as { rating?: string | null }).rating;
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-slate-400">{AXIS_LABEL[axisKey]}</div>
        <TrendArrow trend={data.trend} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <ScorePill n={data.score} />
        {rating ? <Badge tone={rating === "bullish" ? "emerald" : rating === "bear" ? "rose" : "slate"}>{rating}</Badge> : null}
        <span className="text-xs text-slate-500">conf {Math.round((data.confidence ?? 0) * 100)}%</span>
      </div>
      <p className="mt-2 text-sm leading-snug text-slate-300">{data.rationale}</p>
    </div>
  );
}

export function ConvictionBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const tone = score >= 68 ? "emerald" : score >= 50 ? "amber" : "slate";
  const cls: Record<string, string> = {
    emerald: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
  };
  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold ring-1 ${cls[tone]}`} title="conviction score">
      {score >= 68 ? "🔥" : ""}{score}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-400">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
      {label}
    </span>
  );
}
