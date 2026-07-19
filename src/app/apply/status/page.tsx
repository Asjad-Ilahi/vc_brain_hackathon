"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { inputCls } from "../../_components/ui";

type StatusData = {
  company: string;
  submittedAt: string;
  deadlineAt: string | null;
  screened: boolean;
  decision: "invest" | "watch" | "pass" | null;
  feedback: string | null;
};

const OUTCOME: Record<string, { label: string; wash: string; text: string; blurb: string }> = {
  invest: { label: "Advancing", wash: "bg-okwash", text: "text-ok", blurb: "The fund wants to take this further · expect a direct follow-up." },
  watch: { label: "On the watchlist", wash: "bg-warnwash", text: "text-warn", blurb: "Not a yes yet. The fund is tracking your progress and may re-engage as you hit new milestones." },
  pass: { label: "Not this round", wash: "bg-badwash", text: "text-bad", blurb: "The fund isn't moving forward right now. This isn't permanent · founders are re-evaluated whenever new signals appear." },
};

function fmt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ", " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function Step({ done, title, sub }: { done: boolean; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${done ? "bg-[#0045FF] text-white" : "border border-[#d7dbe4] bg-white text-faint"}`}>
        {done ? "✓" : "•"}
      </div>
      <div>
        <p className="text-[13px] font-semibold text-ink">{title}</p>
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
    if (!ref) return;
    let cancelled = false;
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
    const v = manualRef.trim().replace(/^.*[?&]ref=/, "").trim();
    if (v) router.push(`/apply/status?ref=${encodeURIComponent(v)}`);
  }

  const decided = data?.decision ? OUTCOME[data.decision] : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8fb] text-ink">
      <header className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-b from-brand to-branddeep text-white">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M9 1 3 9h4l-1 6 6-8H8l1-6z" /></svg>
          </span>
          <span className="text-[17px] font-extrabold tracking-tight">VC.BRAIN</span>
        </Link>
        <span className="rounded-full bg-white px-3.5 py-2 text-[11px] font-semibold text-muted u-card">Application status</span>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-8">
        <div className="w-full max-w-[560px] rounded-[28px] border border-[#eceef3] bg-white p-8 u-soft md:p-10">
          {(!ref || error) && (
            <div>
              <h1 className="text-[24px] font-extrabold tracking-tight">Check your application</h1>
              <p className="mt-2 text-[13px] text-muted">{error ? error : "Paste the private status link (or reference) you received when you applied."}</p>
              <form onSubmit={submitManual} className="mt-6 flex flex-col gap-3">
                <input value={manualRef} onChange={(e) => setManualRef(e.target.value)} placeholder="app_… or full status link" className={inputCls} />
                <button type="submit" className="u-btn-primary w-full justify-center py-3">Look up status</button>
              </form>
              <div className="mt-6">
                <Link href="/apply" className="text-[12px] font-semibold text-[#0045FF] hover:underline">← Haven&apos;t applied yet? Apply here</Link>
              </div>
            </div>
          )}

          {ref && !error && loading && <div className="py-8 text-center text-[12.5px] text-muted">Loading your status…</div>}

          {ref && !error && !loading && data && (
            <div>
              <div className="mb-7 text-center">
                <span className="inline-block rounded-full bg-[#EBF0FF] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#0045FF]">{data.company}</span>
                <h1 className="mt-3 text-[26px] font-extrabold tracking-tight">{decided ? "Decision in" : "Under review"}</h1>
                <p className="mt-1.5 text-[12.5px] text-muted">
                  Submitted {fmt(data.submittedAt)}{data.deadlineAt ? ` · decision by ${fmt(data.deadlineAt)}` : ""}
                </p>
              </div>

              <div className="flex flex-col gap-4 rounded-2xl border border-[#eceef3] bg-[#fafbfd] p-5">
                <Step done title="Application received" sub={fmt(data.submittedAt)} />
                <Step done={data.screened} title="Screened against thesis" sub={data.screened ? "First-pass screen complete" : "In the queue"} />
                <Step done={!!data.decision} title="Investor decision" sub={data.decision ? "Decided" : data.deadlineAt ? `Due by ${fmt(data.deadlineAt)}` : "Within 24 hours"} />
              </div>

              {decided ? (
                <div className={`mt-6 rounded-2xl p-5 ${decided.wash}`}>
                  <p className={`text-[10.5px] font-bold uppercase tracking-wider ${decided.text}`}>Outcome</p>
                  <p className="mt-1 text-[16px] font-bold text-ink">{decided.label}</p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{decided.blurb}</p>
                  {data.feedback && (
                    <div className="mt-3 border-t border-black/5 pt-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-faint">Investor feedback</p>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-ink">{data.feedback}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-[#dfe7ff] bg-[#EBF0FF] p-5">
                  <p className="text-[12.5px] leading-relaxed text-ink">
                    Your pitch is being audited against the fund thesis and your public footprint. A human investor makes the final call · you&apos;ll see it here{data.deadlineAt ? ` by ${fmt(data.deadlineAt)}` : " within 24 hours"}.
                  </p>
                </div>
              )}

              <div className="mt-7 flex justify-center">
                <Link href="/" className="rounded-full border border-[#e6e8ee] bg-white px-5 py-2.5 text-[13px] font-semibold text-ink hover:border-[#0045FF] hover:text-[#0045FF]">Return home</Link>
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
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#f7f8fb] text-[13px] text-muted">Loading…</div>}>
      <StatusContent />
    </Suspense>
  );
}
