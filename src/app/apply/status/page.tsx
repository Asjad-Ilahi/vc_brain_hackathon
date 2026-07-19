"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import DarkVeilClient from "../../_components/DarkVeilClient";

type StatusData = {
  company: string;
  submittedAt: string;
  deadlineAt: string | null;
  screened: boolean;
  decision: "invest" | "watch" | "pass" | null;
  feedback: string | null;
};

const OUTCOME: Record<string, { label: string; tone: string; blurb: string }> = {
  invest: {
    label: "Advancing",
    tone: "#A3E635",
    blurb: "The fund wants to take this further — expect a direct follow-up.",
  },
  watch: {
    label: "On the watchlist",
    tone: "#FBBF24",
    blurb:
      "Not a yes yet. The fund is tracking your progress and may re-engage as you hit new milestones.",
  },
  pass: {
    label: "Not this round",
    tone: "#F87171",
    blurb:
      "The fund isn't moving forward right now. This isn't permanent — founders are re-evaluated whenever new signals appear.",
  },
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    ", " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function Step({ done, active, title, sub }: { done: boolean; active: boolean; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold"
        style={{
          borderColor: done ? "#0045FF" : active ? "rgba(0,69,255,0.5)" : "rgba(255,255,255,0.12)",
          background: done ? "#0045FF" : "transparent",
          color: done ? "#fff" : active ? "#7aa2ff" : "rgba(255,255,255,0.4)",
        }}
      >
        {done ? "✓" : "•"}
      </div>
      <div>
        <p className="text-[13px] font-semibold text-white">{title}</p>
        <p className="text-[11.5px] text-muted">{sub}</p>
      </div>
    </div>
  );
}

function StatusContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ref = (searchParams.get("ref") ?? "").trim();

  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualRef, setManualRef] = useState("");

  useEffect(() => {
    // No ref → nothing to fetch; render falls through to the lookup form.
    if (!ref) return;
    let cancelled = false;
    // State updates live inside this async fn (not directly in the effect body)
    // so they run as async callbacks, not a synchronous setState-in-effect cascade.
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/apply/status?ref=${encodeURIComponent(ref)}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.ok) throw new Error(json.error || "We couldn't look that up.");
        if (!cancelled) setData(json.data as StatusData);
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setError((e as Error).message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ref]);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    // Accept either a bare ref or a pasted full link (…?ref=app_xxx).
    const v = manualRef.trim().replace(/^.*[?&]ref=/, "").trim();
    if (v) router.push(`/apply/status?ref=${encodeURIComponent(v)}`);
  }

  const decided = data?.decision ? OUTCOME[data.decision] : null;

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col relative overflow-hidden" style={{ background: "#07090E" }}>
      <div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.35, mixBlendMode: "screen" }}>
        <DarkVeilClient hueShift={220} noiseIntensity={0.04} speed={0.4} warpAmount={0.3} />
      </div>

      <header className="w-full max-w-7xl mx-auto px-6 h-20 flex items-center justify-between relative z-10 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2.5 text-white hover:opacity-90 transition-opacity">
          <span className="w-8 h-8 flex items-center justify-center border border-white/30 rounded-lg">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
              <path d="M9 1 3 9h4l-1 6 6-8H8l1-6z" />
            </svg>
          </span>
          <span className="font-mono text-[13px] font-bold tracking-[0.12em]">VC.BRAIN</span>
        </Link>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">Application Status</span>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-[560px] bg-card border border-line p-8 md:p-10 shadow-2xl rounded-2xl" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)" }}>
          {/* No ref, or lookup error → prompt for the ref */}
          {(!ref || error) && (
            <div>
              <h1 className="text-2xl font-bold text-white">Check your application</h1>
              <p className="text-[13px] text-muted mt-2 leading-relaxed">
                {error
                  ? error
                  : "Paste the private status link (or reference) you received when you applied."}
              </p>
              <form onSubmit={submitManual} className="mt-6 flex flex-col gap-3">
                <input
                  value={manualRef}
                  onChange={(e) => setManualRef(e.target.value)}
                  placeholder="app_… or full status link"
                  className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-[13.5px] text-white focus:border-accent focus:outline-none transition-colors"
                />
                <button
                  type="submit"
                  className="rounded-lg px-5 py-2.5 text-[13.5px] font-semibold text-white transition-all"
                  style={{ background: "linear-gradient(90deg, #0045FF 0%, #002999 100%)", boxShadow: "0 4px 15px rgba(0,69,255,0.3)" }}
                >
                  Look up status
                </button>
              </form>
              <div className="mt-6">
                <Link href="/apply" className="font-mono text-[11.5px] text-accent hover:underline">
                  ← Haven&apos;t applied yet? Apply here
                </Link>
              </div>
            </div>
          )}

          {ref && !error && loading && (
            <div className="py-8 text-center font-mono text-[12.5px] text-muted">Loading your status…</div>
          )}

          {ref && !error && !loading && data && (
            <div>
              <div className="text-center mb-7">
                <span className="inline-block bg-accent/10 border border-accent/30 text-accent font-mono text-[10px] uppercase tracking-[0.1em] px-3 py-1 rounded-full">
                  {data.company}
                </span>
                <h1 className="text-2xl font-bold mt-3 text-white">
                  {decided ? "Decision in" : "Under review"}
                </h1>
                <p className="text-[12.5px] text-muted mt-1.5">
                  Submitted {fmt(data.submittedAt)}
                  {data.deadlineAt ? ` · decision by ${fmt(data.deadlineAt)}` : ""}
                </p>
              </div>

              {/* Timeline */}
              <div className="flex flex-col gap-4 border border-white/5 rounded-xl p-5 bg-white/[0.01]">
                <Step done active={false} title="Application received" sub={fmt(data.submittedAt)} />
                <Step
                  done={data.screened}
                  active={!data.screened}
                  title="Screened against thesis"
                  sub={data.screened ? "First-pass screen complete" : "In the queue"}
                />
                <Step
                  done={!!data.decision}
                  active={!data.decision}
                  title="Investor decision"
                  sub={data.decision ? "Decided" : data.deadlineAt ? `Due by ${fmt(data.deadlineAt)}` : "Within 24 hours"}
                />
              </div>

              {/* Outcome */}
              {decided ? (
                <div
                  className="mt-6 rounded-xl p-5 border"
                  style={{ borderColor: `${decided.tone}44`, background: `${decided.tone}0d` }}
                >
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.14em]" style={{ color: decided.tone }}>
                    Outcome
                  </p>
                  <p className="text-[16px] font-bold text-white mt-1">{decided.label}</p>
                  <p className="text-[12.5px] text-muted mt-1.5 leading-relaxed">{decided.blurb}</p>
                  {data.feedback && (
                    <div className="mt-3 border-t border-white/10 pt-3">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-faint">Investor feedback</p>
                      <p className="text-[12.5px] text-white/90 mt-1 leading-relaxed">{data.feedback}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-6 rounded-xl p-5 border border-accent/20 bg-accent/5">
                  <p className="text-[12.5px] text-white/90 leading-relaxed">
                    Your pitch is being audited against the fund thesis and your public footprint.
                    A human investor makes the final call — you&apos;ll see it here
                    {data.deadlineAt ? ` by ${fmt(data.deadlineAt)}` : " within 24 hours"}.
                  </p>
                </div>
              )}

              <div className="mt-7 flex justify-center">
                <Link
                  href="/"
                  className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-5 py-2.5 text-[13px] font-semibold text-white transition-colors"
                >
                  Return to Home
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function ApplyStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-paper text-ink flex items-center justify-center font-mono text-[13px] text-muted" style={{ background: "#07090E" }}>
          Loading…
        </div>
      }
    >
      <StatusContent />
    </Suspense>
  );
}
