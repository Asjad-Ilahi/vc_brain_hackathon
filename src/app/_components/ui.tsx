"use client";
import { useEffect, useState } from "react";
import type { AxisTriple, AxisData } from "@/lib/services/list";

/* ------------------------------- typography ------------------------------- */
export function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`font-mono text-[10.5px] uppercase tracking-[0.18em] text-accent ${className}`}>{children}</div>
  );
}

/* --------------------------------- badges --------------------------------- */
type Tone = "neutral" | "accent" | "ok" | "warn" | "bad";
const TONES: Record<Tone, string> = {
  neutral: "border-line bg-card text-muted",
  accent: "border-accent bg-wash text-accent",
  ok: "border-ok/40 bg-okwash text-ok",
  warn: "border-warn/40 bg-warnwash text-warn",
  bad: "border-bad/40 bg-badwash text-bad",
};

export function Badge({ children, tone = "neutral", title }: { children: React.ReactNode; tone?: Tone; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap border px-1.5 py-px font-mono text-[10.5px] font-medium uppercase tracking-wide ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function scoreTone(n: number): string {
  if (n >= 80) return "text-ok";
  if (n >= 60) return "text-ink";
  return "text-bad";
}

export function ScorePill({ n, label }: { n: number; label?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      {label ? <span className="font-mono text-[10.5px] uppercase tracking-wide text-faint">{label}</span> : null}
      <span className={`tnum font-mono text-base font-bold ${scoreTone(n)}`}>{n}</span>
    </span>
  );
}

/** Bordered trend square — ↑ improving · − stable · ↓ declining. */
export function TrendArrow({ trend, title }: { trend?: string | null; title?: string }) {
  const t = trend === "improving" ? "↑" : trend === "declining" ? "↓" : "−";
  const cls =
    trend === "improving"
      ? "border-ok/40 bg-okwash text-ok"
      : trend === "declining"
        ? "border-bad/40 bg-badwash text-bad"
        : "border-line bg-card text-muted";
  return (
    <span
      title={title ?? trend ?? "stable"}
      className={`inline-grid h-5 w-5 shrink-0 place-items-center border font-mono text-[11px] ${cls}`}
    >
      {t}
    </span>
  );
}

export function TrustBadge({ trustLevel, verification }: { trustLevel: string; verification: string }) {
  const tone: Tone =
    verification === "contradicted"
      ? "bad"
      : trustLevel === "high"
        ? "ok"
        : trustLevel === "medium"
          ? "warn"
          : "neutral";
  const vlabel: Record<string, string> = {
    corroborated: "web-corroborated",
    contradicted: "contradicted",
    not_found: "web: not found",
    na: "not checked",
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tone={tone}>{trustLevel} trust</Badge>
      <Badge tone={verification === "contradicted" ? "bad" : verification === "corroborated" ? "ok" : "neutral"}>
        {vlabel[verification] ?? verification}
      </Badge>
    </span>
  );
}

/** The memo's recommendation (system) vs the decision (human) are distinct. */
export function DecisionBadge({ decision, recommendation }: { decision: string | null; recommendation?: string | null }) {
  if (decision) {
    const tone: Tone = decision === "invest" ? "ok" : decision === "watch" ? "warn" : "bad";
    const label = decision === "invest" ? "deployed" : decision;
    return <Badge tone={tone}>✓ {label}</Badge>;
  }
  if (recommendation)
    return (
      <Badge tone={recommendation === "invest" ? "ok" : recommendation === "watch" ? "warn" : "bad"}>
        recommends {recommendation === "invest" ? "deploy" : recommendation}
      </Badge>
    );
  return <Badge>undecided</Badge>;
}

export function ConvictionBadge({ score, threshold = 68 }: { score: number | null; threshold?: number }) {
  if (score == null) return null;
  const tone: Tone = score >= threshold ? "accent" : score >= 50 ? "warn" : "neutral";
  return (
    <Badge tone={tone} title={`conviction ${score}/100`}>
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

/** The 24h clock — red mono when under 4h, struck when decided. */
export function Countdown({ deadline, decided, className = "" }: { deadline: string | null; decided?: boolean; className?: string }) {
  const now = useNow(15_000);
  const p = countdownParts(deadline, now);
  if (!p || decided) return null;
  return (
    <span
      className={`tnum whitespace-nowrap font-mono text-[12px] font-semibold ${
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
    <span className="inline-flex items-center gap-2 font-mono text-[12px] text-muted">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-line border-t-accent" />
      {label}
    </span>
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: boolean }) {
  return (
    <div className="border border-line bg-card px-4 py-3.5">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.15em] text-muted">{label}</div>
      <div className={`tnum mt-1.5 font-mono text-[26px] font-bold leading-none ${accent ? "text-accent" : ""}`}>{value}</div>
      {sub ? <div className="mt-1.5 text-[11.5px] text-muted">{sub}</div> : null}
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
      className={`border px-2.5 py-1 font-mono text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "border-accent bg-wash text-accent" : "border-line bg-card text-muted hover:border-linestrong hover:text-ink"
      }`}
    >
      {active ? "✓ " : ""}
      {children}
    </button>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-16" onClick={onClose}>
      <div className="w-full max-w-lg border border-linestrong bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-mono text-[15px] font-bold">{title}</h2>
          <button onClick={onClose} className="text-faint hover:text-ink" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const inputCls =
  "mt-1 w-full border border-line bg-paper px-3 py-2 font-mono text-[13px] outline-none focus:border-accent";
export const labelCls = "block font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted";

/* -------------------------------- axis card -------------------------------- */
const AXIS_LABEL: Record<string, string> = {
  founder: "Founder",
  market: "Market",
  idea_vs_market: "Idea vs Market",
};
const AXIS_SUB: Record<string, string> = {
  founder: "traits + track record",
  market: "TAM · competitors · SWOT",
  idea_vs_market: "survives scrutiny?",
};

export function AxisCard({ axisKey, data }: { axisKey: keyof AxisTriple; data?: AxisData }) {
  if (!data) {
    return (
      <div className="border border-dashed border-line bg-card p-4 opacity-70">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.15em] text-muted">{AXIS_LABEL[axisKey]}</div>
        <div className="mt-2 text-[12.5px] text-faint">Not scored yet</div>
      </div>
    );
  }
  return (
    <div className="border border-line bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.15em] text-muted">{AXIS_LABEL[axisKey]}</div>
          <div className="text-[10.5px] text-faint">{AXIS_SUB[axisKey]}</div>
        </div>
        <TrendArrow trend={data.trend} />
      </div>
      <div className="mt-2 flex items-center gap-2.5">
        <span className={`tnum font-mono text-[28px] font-bold leading-none ${scoreTone(data.score)}`}>{data.score}</span>
        {data.prevScore != null && data.prevScore !== data.score ? (
          <span className="tnum font-mono text-[11px] text-faint" title="previous assessment — history kept">
            prev {data.prevScore}
          </span>
        ) : null}
        {data.rating ? (
          <Badge tone={data.rating === "bullish" ? "ok" : data.rating === "bear" ? "bad" : "neutral"}>{data.rating}</Badge>
        ) : null}
      </div>
      <div className="mt-1 font-mono text-[10.5px] text-faint">confidence {Math.round((data.confidence ?? 0) * 100)}%</div>
      <p className="mt-2 text-[12.5px] leading-snug text-muted">{data.rationale}</p>
    </div>
  );
}

/* ------------------------------ agent trace ------------------------------- */
export function TraceLine({ at, agent, text }: { at?: string | null; agent: string; text: string | null }) {
  const time = at
    ? new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;
  return (
    <div className="flex items-baseline gap-2 font-mono text-[11.5px] leading-relaxed">
      <span className="text-accent">›</span>
      {time ? <span className="tnum shrink-0 text-faint">{time}</span> : null}
      <span className="shrink-0 text-ink">{agent}</span>
      <span className="text-faint">→</span>
      <span className="min-w-0 text-muted">{text}</span>
    </div>
  );
}
