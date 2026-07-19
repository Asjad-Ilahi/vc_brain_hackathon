"use client";
import { useEffect, useState } from "react";
import type { AxisTriple, AxisData } from "@/lib/services/list";

/* ------------------------------- typography ------------------------------- */
export function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-[11px] font-bold uppercase tracking-[0.12em] text-brand ${className}`}>{children}</div>
  );
}

/* --------------------------------- badges --------------------------------- */
type Tone = "neutral" | "accent" | "ok" | "warn" | "bad";
const TONES: Record<Tone, string> = {
  neutral: "bg-panel text-muted",
  accent: "bg-brandfaint text-brand",
  ok: "bg-okwash text-ok",
  warn: "bg-warnwash text-warn",
  bad: "bg-badwash text-bad",
};

export function Badge({ children, tone = "neutral", title }: { children: React.ReactNode; tone?: Tone; title?: string }) {
  return (
    <span title={title} className={`u-pill px-2.5 py-1 text-[11.5px] ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function scoreTone(n: number): string {
  if (n >= 80) return "text-ok";
  if (n >= 60) return "text-brand";
  return "text-bad";
}

/** Screenshot pattern: small gray label over a big blue number. */
export function ScorePill({ n, label }: { n: number; label?: string }) {
  return (
    <span className="inline-flex flex-col items-center">
      {label ? <span className="text-[11px] font-medium text-muted">{label}</span> : null}
      <span className={`tnum text-[22px] font-extrabold leading-tight ${scoreTone(n)}`}>{n}</span>
    </span>
  );
}

/** ↑ improving · − stable · ↓ declining — rounded chip. */
export function TrendArrow({ trend, title }: { trend?: string | null; title?: string }) {
  const t = trend === "improving" ? "↑" : trend === "declining" ? "↓" : "−";
  const cls =
    trend === "improving"
      ? "bg-okwash text-ok"
      : trend === "declining"
        ? "bg-badwash text-bad"
        : "bg-panel text-muted";
  return (
    <span
      title={title ?? trend ?? "stable"}
      className={`inline-grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold ${cls}`}
    >
      {t}
    </span>
  );
}

export function TrustBadge({ trustLevel, verification }: { trustLevel: string; verification: string }) {
  const tone: Tone =
    verification === "contradicted" ? "bad" : trustLevel === "high" ? "ok" : trustLevel === "medium" ? "warn" : "neutral";
  const vlabel: Record<string, string> = {
    corroborated: "web-corroborated",
    contradicted: "contradicted",
    not_found: "web: not found",
    na: "not checked",
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge tone={tone}>{trustLevel} trust</Badge>
      <Badge tone={verification === "contradicted" ? "bad" : verification === "corroborated" ? "ok" : "neutral"}>
        {vlabel[verification] ?? verification}
      </Badge>
    </span>
  );
}

export function DecisionBadge({ decision, recommendation }: { decision: string | null; recommendation?: string | null }) {
  if (decision) {
    const tone: Tone = decision === "invest" ? "ok" : decision === "watch" ? "warn" : "bad";
    return <Badge tone={tone}>✓ {decision === "invest" ? "deployed" : decision}</Badge>;
  }
  if (recommendation)
    return (
      <Badge tone={recommendation === "invest" ? "ok" : recommendation === "watch" ? "warn" : "bad"}>
        memo says {recommendation === "invest" ? "deploy" : recommendation}
      </Badge>
    );
  return <Badge>undecided</Badge>;
}

export function ConvictionBadge({ score, threshold = 68 }: { score: number | null; threshold?: number }) {
  if (score == null) return null;
  const tone: Tone = score >= threshold ? "accent" : score >= 50 ? "warn" : "neutral";
  return (
    <Badge tone={tone} title={`match ${score}/100`}>
      <span className="tnum">{score}</span>
    </Badge>
  );
}

/* -------------------------------- countdown -------------------------------- */
export function useNow(tickMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);
  return now;
}

export function countdownParts(deadlineIso: string | null, now: number) {
  if (!deadlineIso) return null;
  const ms = new Date(deadlineIso).getTime() - now;
  const expired = ms <= 0;
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600_000);
  const m = Math.floor((abs % 3600_000) / 60_000);
  return { label: `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`, expired, urgent: !expired && ms < 4 * 3600_000, ms };
}

export function Countdown({ deadline, decided, className = "" }: { deadline: string | null; decided?: boolean; className?: string }) {
  const now = useNow(15_000);
  const p = countdownParts(deadline, now);
  if (!p || decided) return null;
  return (
    <span
      className={`tnum whitespace-nowrap text-[13px] font-bold ${
        p.expired ? "text-faint line-through" : p.urgent ? "text-bad" : "text-muted"
      } ${className}`}
      title={p.expired ? "24h window elapsed" : "time left on the 24h clock"}
    >
      {p.expired ? "overdue" : p.label}
    </span>
  );
}

/* ---------------------------------- misc ----------------------------------- */
export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-muted">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brandfaint border-t-brand" />
      {label}
    </span>
  );
}

export function Stat({ label, value, sub, icon }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="bg-[#F8F8F8] rounded-[24px] p-6 shadow-none border-0 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between">
          <div className="text-[12.5px] font-semibold text-[#0045FF] font-sans">{label}</div>
          {icon ? <span className="grid h-10 w-10 place-items-center rounded-full bg-[#EBF0FF] text-[#0045FF]">{icon}</span> : null}
        </div>
        <div className="tnum mt-4 text-[36px] font-bold leading-none text-ink">{value}</div>
      </div>
      {sub ? <div className="mt-2 text-[11.5px] text-muted font-sans">{sub}</div> : null}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
  disabled,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "bg-brand text-white shadow-sm" : "bg-panel text-ink hover:bg-brandfaint hover:text-brand"
      }`}
    >
      {children}
    </button>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-16" onClick={onClose}>
      <div className="u-card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-bold">{title}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-faint hover:bg-panel hover:text-ink" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const inputCls =
  "mt-1.5 w-full rounded-full border-none bg-[#F8F8F8] px-6 py-4.5 text-[14px] text-ink outline-none transition-colors placeholder:text-faint focus:bg-[#f0f0f0]";
export const labelCls = "block text-[12.5px] font-bold text-ink";

/* -------------------------------- axis card -------------------------------- */
const AXIS_LABEL: Record<string, string> = { founder: "Founder axis", market: "Market axis", idea_vs_market: "Idea axis" };
const AXIS_SUB: Record<string, string> = {
  founder: "traits + track record",
  market: "TAM · competitors · SWOT",
  idea_vs_market: "survives scrutiny?",
};

export function AxisCard({ axisKey, data }: { axisKey: keyof AxisTriple; data?: AxisData }) {
  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-linestrong bg-cardalt p-4 opacity-70">
        <div className="text-[12px] font-bold text-muted">{AXIS_LABEL[axisKey]}</div>
        <div className="mt-2 text-[12.5px] text-faint">Not scored yet</div>
      </div>
    );
  }
  return (
    <div className="u-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[12px] font-bold text-ink">{AXIS_LABEL[axisKey]}</div>
          <div className="text-[11px] text-faint">{AXIS_SUB[axisKey]}</div>
        </div>
        <TrendArrow trend={data.trend} />
      </div>
      <div className="mt-2 flex items-baseline gap-2.5">
        <span className={`tnum text-[30px] font-extrabold leading-none ${scoreTone(data.score)}`}>{data.score}</span>
        {data.prevScore != null && data.prevScore !== data.score ? (
          <span className="tnum text-[11px] text-faint" title="previous assessment — history kept">prev {data.prevScore}</span>
        ) : null}
        {data.rating ? <Badge tone={data.rating === "bullish" ? "ok" : data.rating === "bear" ? "bad" : "neutral"}>{data.rating}</Badge> : null}
      </div>
      <div className="mt-1 text-[11px] text-faint">confidence {Math.round((data.confidence ?? 0) * 100)}%</div>
      <p className="mt-2 text-[12.5px] leading-snug text-muted">{data.rationale}</p>
    </div>
  );
}

/* ------------------------------ agent trace ------------------------------- */
export function TraceLine({ at, agent, text }: { at?: string | null; agent: string; text: string | null }) {
  const time = at ? new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : null;
  return (
    <div className="flex items-baseline gap-2 text-[12.5px] leading-relaxed">
      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
      {time ? <span className="tnum shrink-0 text-faint">{time}</span> : null}
      <span className="shrink-0 font-bold text-ink">{agent}</span>
      <span className="text-faint">→</span>
      <span className="min-w-0 text-muted">{text}</span>
    </div>
  );
}
