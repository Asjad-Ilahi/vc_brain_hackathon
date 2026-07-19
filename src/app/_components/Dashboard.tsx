"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OpportunitySummary } from "@/lib/services/list";
import type { Thesis, ThesisProfile } from "@/lib/services/thesis";
import { api, postJson, fmtDuration } from "./api";
import { Badge, Countdown, ScorePill, Spinner, Stat, countdownParts, useNow } from "./ui";
import { ApplyModal, GhostButton, PrimaryButton } from "./shared";
import { SweepLoader, useSweep } from "./useSweep";

type Activity = { id: string; agent: string; outputSummary: string | null; createdAt: string; opportunityId: string; company: string };
type ChannelStat = { name: string; found: number; quality: number };
type AutoStatus = { ready: number; working: number; queued: number; decided: number; screenedOut: number };

const AUTOPILOT_CONCURRENCY = 2;
const AUTOPILOT_DEFAULT_TARGET = 10;

export default function Dashboard() {
  const router = useRouter();
  const now = useNow(30_000);
  const [opps, setOpps] = useState<OpportunitySummary[]>([]);
  const [thesis, setThesis] = useState<Thesis | null>(null);
  const [channels, setChannels] = useState<ChannelStat[]>([]);
  const [founderCount, setFounderCount] = useState<{ total: number; week: number } | null>(null);
  const [account, setAccount] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [showApply, setShowApply] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const [o, t, c, f] = await Promise.all([
        api<OpportunitySummary[]>("/api/opportunities"),
        api<{ active: Thesis | null }>("/api/thesis"),
        api<{ channels: ChannelStat[] }>("/api/channels").catch(() => ({ channels: [] })),
        api<{ firstSeenAt: string }[]>("/api/founders").catch(() => []),
      ]);
      setOpps(o);
      setThesis(t.active);
      setChannels(c.channels);
      api<{ user: { name: string } | null }>("/api/auth/me").then((r) => setAccount(r.user)).catch(() => {});
      const week = f.filter((x) => Date.now() - new Date(x.firstSeenAt).getTime() < 7 * 86_400_000).length;
      setFounderCount({ total: f.length, week });
    } catch (e) {
      setStatus(`Load failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Autopilot: background agents take each find through the full check.
  const [auto, setAuto] = useState<AutoStatus | null>(null);
  const [target, setTarget] = useState<number>(AUTOPILOT_DEFAULT_TARGET);
  const inFlight = useRef(0);

  useEffect(() => {
    try {
      const t = Number(localStorage.getItem("vcb.autopilot.target"));
      if (t > 0) setTarget(t);
    } catch {}
  }, []);

  const refreshAuto = useCallback(async () => {
    try {
      setAuto(await api<AutoStatus>("/api/autopilot/status"));
    } catch {}
  }, []);

  useEffect(() => {
    refreshAuto();
    const t = setInterval(refreshAuto, 5000);
    return () => clearInterval(t);
  }, [refreshAuto]);

  useEffect(() => {
    const tick = setInterval(() => {
      if (!auto) return;
      const finished = auto.ready + auto.decided;
      if (finished >= target || auto.queued === 0) return;
      if (inFlight.current >= AUTOPILOT_CONCURRENCY) return;
      inFlight.current += 1;
      postJson<{ processed: string | null }>("/api/autopilot/next")
        .catch(() => null)
        .finally(() => {
          inFlight.current -= 1;
          refreshAuto();
          load();
        });
    }, 4000);
    return () => clearInterval(tick);
  }, [auto, target, refreshAuto, load]);

  function processMore() {
    const next = (auto ? auto.ready + auto.decided : 0) + AUTOPILOT_DEFAULT_TARGET;
    setTarget(next);
    try {
      localStorage.setItem("vcb.autopilot.target", String(next));
    } catch {}
  }

  const sweep = useSweep(load);

  function scoutAll() {
    setStatus(null);
    sweep.start(((thesis?.profileJson ?? null) as ThesisProfile | null)?.enabledSources);
  }

  useEffect(() => {
    if (!thesis) return;
    try {
      if (localStorage.getItem("vcb.sweep.request") === "1") {
        localStorage.removeItem("vcb.sweep.request");
        sweep.start(((thesis.profileJson ?? null) as ThesisProfile | null)?.enabledSources);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thesis]);

  const profile = (thesis?.profileJson ?? null) as ThesisProfile | null;
  const threshold = thesis?.convictionThreshold ?? 68;

  const undecided = opps.filter((o) => !o.decision);
  const awaiting = opps.filter((o) => o.status === "awaiting_decision" && !o.decision);
  const urgent = undecided.filter((o) => {
    const p = countdownParts(o.deadlineAt, now);
    return p && !p.expired && p.urgent;
  });
  const crossed = opps
    .filter((o) => o.source === "outbound" && !o.decision && o.status !== "awaiting_decision" && (o.convictionScore ?? 0) >= threshold)
    .sort((a, b) => (b.convictionScore ?? 0) - (a.convictionScore ?? 0));
  const crossed24h = crossed.filter((o) => now - new Date(o.firstSignalAt).getTime() < 24 * 3600_000);
  const signals24h = opps.filter((o) => now - new Date(o.firstSignalAt).getTime() < 24 * 3600_000).length;
  const decidedList = opps.filter((o) => o.timeToDecisionMs != null);
  const avgTtd = decidedList.length ? decidedList.reduce((s, o) => s + (o.timeToDecisionMs ?? 0), 0) / decidedList.length : null;

  const hour = new Date(now).getHours();
  const daypart = hour < 5 ? "Night" : hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  const firstName = (profile?.gpName ?? account?.name)?.split(/\s+/)[0];
  const calibratedDays = thesis ? Math.max(0, Math.floor((now - new Date(thesis.createdAt).getTime()) / 86_400_000)) : null;
  const channelBits = channels.slice(0, 3).map((c) => `${c.name} ${c.found}`).join(" · ");

  const readyShown = awaiting.sort((a, b) => (b.axes.founder?.score ?? 0) - (a.axes.founder?.score ?? 0));
  const readyLimit = showAll ? readyShown.length : 4;

  if (loading)
    return (
      <div className="grid place-items-center py-40">
        <Spinner label="Loading command center…" />
      </div>
    );

  if (!thesis) {
    return (
      <div className="mx-auto max-w-xl py-24 text-center">
        <h1 className="text-4xl font-extrabold leading-tight">
          Decide on any deal in <span className="text-brand">24 hours.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[14px] text-muted">
          Set up your thesis and we start finding founders that fit — checked and ready for your yes or no.
        </p>
        <div className="mt-8 flex justify-center gap-2.5">
          <PrimaryButton onClick={() => router.push("/onboarding")}>Set up your thesis →</PrimaryButton>
          <GhostButton onClick={() => setShowApply(true)}>Submit an application</GhostButton>
        </div>
        {showApply && <ApplyModal onClose={() => setShowApply(false)} onDone={(id) => router.push(`/opportunity/${id}`)} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Greeting card */}
      <div className="u-panel flex flex-wrap items-center justify-between gap-5 px-7 py-7">
        <div className="min-w-0">
          <h1 className="text-[30px] font-extrabold leading-tight text-ink">
            Good {daypart} {firstName ? <span className="text-brand">{firstName}</span> : null}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-muted">
            <span>{undecided.length} opportunities awaiting decision.</span>
            <span className="font-bold text-brand">+</span>
            <span>Thesis calibrated {calibratedDays === 0 ? "today" : `${calibratedDays}d ago`}</span>
            <span className="font-bold text-brand">+</span>
            <span>{crossed.length} crossed the match threshold</span>
          </div>
        </div>
        <div className="flex shrink-0 gap-2.5">
          <GhostButton onClick={() => setShowApply(true)}>New Application</GhostButton>
          <PrimaryButton onClick={scoutAll} disabled={sweep.running}>Find Founders</PrimaryButton>
        </div>
      </div>

      {/* Live search + autopilot banners */}
      {sweep.channels.length > 0 ? <SweepLoader channels={sweep.channels} running={sweep.running} total={sweep.total} /> : null}
      {auto && (auto.working > 0 || (auto.queued > 0 && auto.ready + auto.decided < target)) ? (
        <div className="u-card flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
          <span className="flex items-center gap-2.5 text-[13px] text-muted">
            <Spinner />
            Agents working in the background — <b className="text-ink">{auto.ready}</b> ready for you · {auto.working} being checked · {auto.queued} waiting
          </span>
          <span className="text-[11.5px] text-faint">full check: background → screen → 3 scores → memo → verify</span>
        </div>
      ) : null}
      {status ? <div className="u-card px-5 py-3 text-[13px] text-muted">{status}</div> : null}

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="All Pipeline Opportunities" value={undecided.length} sub={`${awaiting.length} awaiting your decision`} icon={<IcnPipeline />} />
        <Stat label="New Finds · 24h" value={signals24h} sub={channelBits || "run a search"} icon={<IcnRadar />} />
        <Stat label="Founders In Memory" value={founderCount?.total ?? "—"} sub={founderCount ? `+${founderCount.week} this week` : undefined} icon={<IcnDb />} />
        <Stat label="Avg Time To Decision" value={fmtDuration(avgTtd)} sub="first signal → decision" icon={<IcnClock />} />
      </div>

      {/* Strong matches — blue panel */}
      <section className="rounded-[26px] bg-brandsoft p-5 u-soft">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-[15px] font-bold text-white">Strong Matches From Your Search</h2>
          <Link href="/radar" className="text-[12.5px] font-semibold text-white/90 hover:text-white">View All ↗</Link>
        </div>
        <div className="space-y-2.5">
          {crossed.length === 0 ? (
            <div className="rounded-2xl bg-white/95 px-5 py-6 text-center text-[13px] text-muted">
              No strong matches yet — press <b>Find Founders</b> to search.
            </div>
          ) : (
            crossed.slice(0, 4).map((o) => <DealRow key={o.id} o={o} onLight />)
          )}
        </div>
      </section>

      {/* Ready for decisions — gray panel */}
      <section className="u-panel p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2 px-1">
          <h2 className="text-[15px] font-bold text-ink">Ready For Your Decisions</h2>
          <span className="font-bold text-brand">+</span>
          <span className="text-[13px] text-muted">Fully Checked By The Agents</span>
        </div>
        <div className="space-y-2.5">
          {readyShown.length === 0 ? (
            <div className="rounded-2xl bg-white px-5 py-6 text-center text-[13px] text-faint">
              {auto && (auto.working > 0 || auto.queued > 0)
                ? "Agents are running the first full checks — results appear here."
                : "Nothing waiting on you. Press Find Founders or add an application."}
            </div>
          ) : (
            readyShown.slice(0, readyLimit).map((o) => <DealRow key={o.id} o={o} />)
          )}
        </div>
        {readyShown.length > 4 ? (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => (showAll ? setShowAll(false) : auto && auto.queued > 0 && auto.ready + auto.decided >= target ? processMore() : setShowAll(true))}
              className="u-btn u-btn-ghost px-6 py-2.5 text-[13px]"
            >
              {showAll ? "Show less" : "View More"}
            </button>
          </div>
        ) : awaiting.length > 0 && auto && auto.queued > 0 && auto.ready + auto.decided >= target ? (
          <div className="mt-4 flex justify-center">
            <button onClick={processMore} className="u-btn u-btn-ghost px-6 py-2.5 text-[13px]">Check {AUTOPILOT_DEFAULT_TARGET} more</button>
          </div>
        ) : null}
      </section>

      {showApply && (
        <ApplyModal
          onClose={() => setShowApply(false)}
          onDone={(id) => {
            setShowApply(false);
            router.push(`/opportunity/${id}`);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------- deal row ------------------------------- */
function DealRow({ o, onLight }: { o: OpportunitySummary; onLight?: boolean }) {
  const founder = o.founders[0]?.name;
  const scored = o.axes.founder || o.axes.market || o.axes.idea_vs_market;
  return (
    <Link href={`/opportunity/${o.id}`} className="u-card u-card-hover flex flex-wrap items-center gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[16px] font-bold text-ink">{o.company}</span>
          {founder ? <Badge tone="accent">{founder}</Badge> : null}
          {o.recommendation ? (
            <Badge tone={o.recommendation === "invest" ? "ok" : o.recommendation === "watch" ? "accent" : "bad"}>
              Memo says {o.recommendation === "invest" ? "deploy" : o.recommendation}
            </Badge>
          ) : o.screenResult === "pass" ? (
            <Badge tone="accent">Passed first check</Badge>
          ) : null}
          {o.flags > 0 ? <Badge tone="warn">⚠ {o.flags}</Badge> : null}
          <span className="text-[12.5px] text-muted"><Countdown deadline={o.deadlineAt} decided={!!o.decision} /></span>
        </div>
        <p className="mt-1 truncate text-[12.5px] text-muted">{o.oneLiner ?? o.convictionReason ?? "—"}</p>
      </div>
      <div className="flex shrink-0 items-center gap-5 rounded-2xl bg-cardalt px-5 py-2.5">
        {scored ? (
          <>
            <ScorePill n={o.axes.founder?.score ?? 0} label="Founder axis" />
            <ScorePill n={o.axes.market?.score ?? 0} label="Market axis" />
            <ScorePill n={o.axes.idea_vs_market?.score ?? 0} label="Idea axis" />
          </>
        ) : (
          <ScorePill n={o.convictionScore ?? 0} label="Match" />
        )}
      </div>
    </Link>
  );
}

/* --------------------------------- icons -------------------------------- */
function I({ children }: { children: React.ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}
function IcnPipeline() {
  return <I><path d="M4 6h5M4 10h9M4 14h6" /><circle cx="15" cy="6" r="1.6" /><circle cx="8" cy="14" r="1.6" /></I>;
}
function IcnRadar() {
  return <I><circle cx="10" cy="10" r="7" /><circle cx="10" cy="10" r="3" /><path d="M10 10l5-5" /></I>;
}
function IcnDb() {
  return <I><ellipse cx="10" cy="5" rx="6" ry="2.4" /><path d="M4 5v10c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4V5" /></I>;
}
function IcnClock() {
  return <I><circle cx="10" cy="10" r="7" /><path d="M10 6v4l2.5 2" /></I>;
}
