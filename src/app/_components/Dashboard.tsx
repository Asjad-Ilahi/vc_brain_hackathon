"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OpportunitySummary } from "@/lib/services/list";
import type { Thesis, ThesisProfile } from "@/lib/services/thesis";
import { api, postJson, fmtDuration } from "./api";
import { Badge, Countdown, Eyebrow, ScorePill, Spinner, Stat, TraceLine, TrendArrow, countdownParts, useNow } from "./ui";
import { ApplyModal, GhostButton, PrimaryButton, initialsOf } from "./shared";
import { SweepLoader, useSweep } from "./useSweep";

type Activity = { id: string; agent: string; outputSummary: string | null; createdAt: string; opportunityId: string; company: string };
type ChannelStat = { name: string; found: number; quality: number };
type AutoStatus = { ready: number; working: number; queued: number; decided: number; screenedOut: number };
type GraphNode = {
  id: string;
  institutionName: string;
  programName: string;
  qualityRating: number;
  companyName: string;
  founderName: string;
  opportunityId: string;
};
type ChannelIntel = {
  channels: ChannelStat[];
  suggestions: { channel: string; why: string }[];
  graphNodes: GraphNode[];
};

const AUTOPILOT_CONCURRENCY = 2; // parallel background workers
const AUTOPILOT_DEFAULT_TARGET = 10; // fully-checked deals before pausing

export default function Dashboard() {
  const router = useRouter();
  const now = useNow(30_000);
  const [opps, setOpps] = useState<OpportunitySummary[]>([]);
  const [thesis, setThesis] = useState<Thesis | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [channels, setChannels] = useState<ChannelStat[]>([]);
  const [suggestions, setSuggestions] = useState<{ channel: string; why: string }[]>([]);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [founderCount, setFounderCount] = useState<{ total: number; week: number } | null>(null);
  const [account, setAccount] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [showApply, setShowApply] = useState(false);

  const load = useCallback(async () => {
    try {
      const [o, t, a, c, f] = await Promise.all([
        api<OpportunitySummary[]>("/api/opportunities"),
        api<{ active: Thesis | null }>("/api/thesis"),
        api<Activity[]>("/api/activity").catch(() => []),
        api<ChannelIntel>("/api/channels").catch(() => ({ channels: [], suggestions: [], graphNodes: [] })),
        api<{ firstSeenAt: string }[]>("/api/founders").catch(() => []),
      ]);
      setOpps(o);
      setThesis(t.active);
      setActivity(a);
      setChannels(c.channels);
      setSuggestions(c.suggestions || []);
      setGraphNodes(c.graphNodes || []);
      api<{ user: { name: string } | null }>("/api/auth/me")
        .then((r) => setAccount(r.user))
        .catch(() => { });
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

  // ---------------------------------------------------------------------
  // Autopilot: after the profile is saved, background agents take each find
  // through the FULL check — background check, screening, 3-way scoring,
  // memo, verification — in parallel, until `target` deals are finished.
  // The investor sees results, not buttons.
  // ---------------------------------------------------------------------
  const [auto, setAuto] = useState<AutoStatus | null>(null);
  const [target, setTarget] = useState<number>(AUTOPILOT_DEFAULT_TARGET);
  const inFlight = useRef(0);

  useEffect(() => {
    try {
      const t = Number(localStorage.getItem("vcb.autopilot.target"));
      if (t > 0) setTarget(t);
    } catch { }
  }, []);

  const refreshAuto = useCallback(async () => {
    try {
      setAuto(await api<AutoStatus>("/api/autopilot/status"));
    } catch { }
  }, []);

  useEffect(() => {
    refreshAuto();
    const t = setInterval(refreshAuto, 5000);
    return () => clearInterval(t);
  }, [refreshAuto]);

  // Worker pump: keep up to N parallel background checks running until the
  // target is met or the queue is empty.
  useEffect(() => {
    const tick = setInterval(() => {
      if (!auto) return;
      const finished = auto.ready + auto.decided;
      if (finished >= target) return;
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
    } catch { }
  }

  // Live founder search with per-source progress; results stream in as each
  // source finishes.
  const sweep = useSweep(load);

  function scoutAll() {
    setStatus(null);
    sweep.start(((thesis?.profileJson ?? null) as ThesisProfile | null)?.enabledSources);
  }

  // Onboarding hands off here: the wizard sets a flag, the dashboard runs the
  // first search visibly so the investor watches results arrive one by one.
  useEffect(() => {
    if (!thesis) return;
    try {
      if (localStorage.getItem("vcb.sweep.request") === "1") {
        localStorage.removeItem("vcb.sweep.request");
        sweep.start(((thesis.profileJson ?? null) as ThesisProfile | null)?.enabledSources);
      }
    } catch { }
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
  const overdue = undecided.filter((o) => {
    const p = countdownParts(o.deadlineAt, now);
    return p?.expired;
  });
  const crossed = opps
    .filter((o) => o.source === "outbound" && !o.decision && o.status !== "awaiting_decision" && (o.convictionScore ?? 0) >= threshold)
    .sort((a, b) => (b.convictionScore ?? 0) - (a.convictionScore ?? 0));
  const crossed24h = crossed.filter((o) => now - new Date(o.firstSignalAt).getTime() < 24 * 3600_000);
  const signals24h = opps.filter((o) => now - new Date(o.firstSignalAt).getTime() < 24 * 3600_000).length;
  const decided = opps.filter((o) => o.timeToDecisionMs != null);
  const avgTtd = decided.length ? decided.reduce((s, o) => s + (o.timeToDecisionMs ?? 0), 0) / decided.length : null;

  const hour = new Date(now).getHours();
  const daypart = hour < 5 ? "night" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const firstName = (profile?.gpName ?? account?.name)?.split(/\s+/)[0];
  const calibratedDays = thesis
    ? Math.max(0, Math.floor((now - new Date(thesis.createdAt).getTime()) / 86_400_000))
    : null;

  const channelBits = channels
    .slice(0, 3)
    .map((c) => `${c.name} ${c.found}`)
    .join(" · ");

  if (loading && !thesis) return null;

  // First run: no thesis yet → onboarding is the front door.
  if (!thesis) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <Eyebrow className="justify-center text-center">A venture OS for solo GPs</Eyebrow>
        <h1 className="mt-4 font-mono text-4xl font-bold leading-tight">
          Decide on any deal
          <br />
          in <span className="text-accent">24 hours.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[13.5px] text-muted">
          VC.Brain sources founders, screens them against your thesis, and hands you a memo with
          citations. You just say yes or no.
        </p>
        <div className="mt-8 flex justify-center gap-2">
          <PrimaryButton onClick={() => router.push("/onboarding")}>Start onboarding →</PrimaryButton>
          <GhostButton onClick={() => setShowApply(true)}>Submit an application</GhostButton>
        </div>
        <p className="mt-4 font-mono text-[11px] text-faint">Ready in 6 minutes.</p>
        {showApply && (
          <ApplyModal onClose={() => setShowApply(false)} onDone={(id) => router.push(`/opportunity/${id}`)} />
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Command header */}
      <div className="mb-6 px-6 md:px-8 pt-6">
        <div className="bg-[#F8F8F8] rounded-[28px] p-8 flex flex-wrap items-center justify-between gap-6 border-0 shadow-none">
          <div>
            <h1 className="font-sans text-[32px] tracking-tight text-ink font-light">
              Good {daypart === "morning" ? "Morning" : daypart === "afternoon" ? "Afternoon" : daypart === "night" ? "Night" : "Evening"}{" "}
              <span className="text-[#0045FF] font-bold">{firstName || "Lena"}</span>
            </h1>
            <p className="mt-2.5 font-sans text-[13.5px] text-muted flex flex-wrap items-center gap-1.5 font-medium">
              <span>Opportunities awaiting decision.</span>
              <span className="text-[#0045FF] font-bold text-[15px] mx-1">+</span>
              <span>Thesis to be calibrated</span>
              <span className="text-[#0045FF] font-bold text-[15px] mx-1">+</span>
              <span>Cross conviction thresholds</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowApply(true)}
              className="rounded-full border border-[#dcdfe8] bg-transparent px-6 py-3.5 text-center text-[13.5px] font-semibold text-ink transition-all hover:bg-[#F8F8F8] cursor-pointer"
            >
              New Application
            </button>
            <Link
              href="/radar"
              className="rounded-full bg-[#0045FF] px-6 py-3.5 text-center text-[13.5px] font-bold text-white transition-all hover:bg-[#0033cc] cursor-pointer"
            >
              Find Founders
            </Link>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 md:px-8">
        {sweep.channels.length > 0 ? (
          <div className="mb-5">
            <SweepLoader channels={sweep.channels} running={sweep.running} total={sweep.total} />
          </div>
        ) : null}
        {auto && (auto.working > 0 || auto.queued > 0 || auto.ready + auto.decided < target) ? (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border border-line bg-card px-3.5 py-2.5">
            <span className="flex items-center gap-2.5 font-mono text-[12px] text-muted">
              <Spinner />
              {auto.working > 0 || auto.queued > 0 ? (
                <span>Agents working in the background — <strong className="text-ink">{auto.ready}</strong> ready for you · {auto.working} being checked · {auto.queued} waiting</span>
              ) : (
                <span className="animate-pulse text-accent">Autonomous Agent active — continuously scanning channels for new founders...</span>
              )}
            </span>
            <span className="font-mono text-[10.5px] text-faint">
              full check: background → screen → 3 scores → memo → verify
            </span>
          </div>
        ) : null}
        {(busy || status) && (
          <div className="mb-5 border border-line bg-card px-3 py-2 text-[12.5px]">
            {busy ? <Spinner label={busy} /> : <span className="text-muted">{status}</span>}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <Stat
            label="All Pipeline Opportunities"
            value={undecided.length}
            sub={`+${crossed24h.length} new from 24 hr run`}
            icon={<IconNetwork />}
          />
          <Stat
            label="New Finds , 24h"
            value={signals24h}
            sub={channelBits || "run a search"}
            icon={<IconRadar />}
          />
          <Stat
            label="Founders In Memory"
            value={founderCount?.total ?? "—"}
            sub={founderCount ? `+${founderCount.week} this week` : undefined}
            icon={<IconDatabase />}
          />
          <Stat
            label="Avg Time To Decision"
            value={avgTtd ? fmtDuration(avgTtd) : "-"}
            sub="first signal"
            icon={<IconClock />}
          />
        </div>

        {/* Main Dashboard Layout */}
        <div className="mt-6 flex flex-col gap-6">

          {/* Section 1: Ready For Your Decisions (Solid blue container - moved above) */}
          <section className="bg-[#5F83FF] text-white rounded-[28px] p-6 pb-8 shadow-none border-0">
            <div className="flex items-center gap-2 px-2 pb-4 font-sans text-[15px] font-bold text-white">
              <span>Ready For Your Decisions</span>
              <span className="text-white font-bold text-[16px] mx-1">+</span>
              <span className="text-white/80 font-medium">Fully Checked By The Agents</span>
            </div>

            <div className="border-t border-white/5 pt-4 space-y-4">
              {awaiting.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-white/80 font-sans">
                  {auto && (auto.working > 0 || auto.queued > 0)
                    ? "Agents are running the first full checks — results appear here."
                    : "Nothing waiting on you. The autonomous agent is continuously checking for deals, or you can add an application."}
                </p>
              ) : (
                awaiting
                  .sort((a, b) => (b.axes.founder?.score ?? 0) - (a.axes.founder?.score ?? 0))
                  .slice(0, 10)
                  .map((o) => {
                    const isDeploy = o.recommendation === "invest";
                    const isPass = o.recommendation === "pass";

                    const badgeBg = isDeploy ? "bg-[#E7F6EE]" : isPass ? "bg-[#FDEAEE]" : "bg-[#FDF2D8]";
                    const badgeText = isDeploy ? "text-[#12A150]" : isPass ? "text-[#E0355A]" : "text-[#B7791F]";

                    return (
                      <Link
                        key={o.id}
                        href={`/opportunity/${o.id}`}
                        className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-[28px] md:rounded-full px-8 py-4.5 border-0 shadow-none hover:bg-slate-50 transition-all"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-sans text-[15px] font-bold text-ink">{o.company}</span>
                            <span className="rounded-full bg-[#EBF0FF] text-[#0045FF] px-3.5 py-1 text-[11px] font-bold font-sans">
                              Inventor Of {o.company}
                            </span>
                            {o.recommendation && (
                              <span className={`rounded-full ${badgeBg} ${badgeText} px-3.5 py-1 text-[11px] font-bold font-sans`}>
                                Memo Says {o.recommendation === "invest" ? "Deploy" : o.recommendation.charAt(0).toUpperCase() + o.recommendation.slice(1)}
                              </span>
                            )}
                            {o.deadlineAt && (
                              <span className="text-[12px] text-muted font-medium font-sans ml-1 flex items-center gap-1">
                                <Countdown deadline={o.deadlineAt} decided={!!o.decision} />
                              </span>
                            )}
                          </div>
                          <div className="text-[13px] text-muted font-sans mt-1 truncate">{o.oneLiner ?? o.convictionReason}</div>
                        </div>

                        <div className="bg-[#F8F8F8] border border-[#eceef3] rounded-[20px] md:rounded-full px-6 py-2 flex items-center justify-around md:justify-end gap-6 shrink-0">
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] uppercase tracking-wider text-[#9E9E9E] font-medium font-sans">Founder axis</span>
                            <span className="text-[20px] font-bold text-[#0045FF] font-sans mt-0.5">{o.axes.founder?.score ?? "—"}</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] uppercase tracking-wider text-[#9E9E9E] font-medium font-sans">Market axis</span>
                            <span className="text-[20px] font-bold text-[#0045FF] font-sans mt-0.5">{o.axes.market?.score ?? "—"}</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] uppercase tracking-wider text-[#9E9E9E] font-medium font-sans">Idea axis</span>
                            <span className="text-[20px] font-bold text-[#0045FF] font-sans mt-0.5">{o.axes.idea_vs_market?.score ?? "—"}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })
              )}
            </div>

            {auto && auto.ready + auto.decided >= target ? (
              <button
                onClick={processMore}
                className="mt-6 mx-auto block rounded-full border border-white/40 bg-transparent px-8 py-2.5 text-center text-[13px] font-bold uppercase tracking-wider text-white transition-all hover:bg-white/10 cursor-pointer"
              >
                View More
              </button>
            ) : null}
          </section>

          {/* Section 2: Strong Matches From Your Search (Light grey container - moved below) */}
          <section className="bg-[#F8F8F8] rounded-[28px] p-6 pb-8 shadow-none border-0">
            <div className="flex items-center justify-between px-2 pb-4">
              <span className="font-sans text-[15px] font-bold uppercase tracking-wider text-ink">
                Strong Matches From Your Search
              </span>
              <Link href="/radar" className="font-sans text-[13px] font-bold text-[#0045FF] hover:underline flex items-center gap-1">
                View All <span className="text-[14px]">→</span>
              </Link>
            </div>
            
            <div className="border-t border-[#eceef3] pt-4 space-y-4">
              {crossed.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-muted font-sans">
                  No strong matches yet — run a search.
                </p>
              ) : (
                crossed.slice(0, 5).map((o) => (
                  <Link
                    key={o.id}
                    href={`/opportunity/${o.id}`}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-[28px] md:rounded-full px-8 py-4.5 border-0 shadow-none hover:bg-slate-50 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-sans text-[15px] font-bold text-ink">{o.company}</span>
                        <span className="rounded-full bg-[#EBF0FF] text-[#0045FF] px-3.5 py-1 text-[11px] font-bold font-sans">
                          {o.founders[0]?.name ?? "Unknown"}
                        </span>
                        <span className="rounded-full bg-[#EBF0FF] text-[#0045FF] px-3.5 py-1 text-[11px] font-bold font-sans">
                          {o.screenResult === "pass" ? "Passed First Check" : o.screenResult === "reject" ? "Screened Out" : "Screening"}
                        </span>
                        {o.deadlineAt && (
                          <span className="text-[12px] text-muted font-medium font-sans ml-1 flex items-center gap-1">
                            <Countdown deadline={o.deadlineAt} decided={!!o.decision} />
                          </span>
                        )}
                      </div>
                      <div className="text-[13px] text-muted font-sans mt-1 truncate">{o.oneLiner ?? o.convictionReason}</div>
                    </div>

                    <div className="bg-[#F8F8F8] border border-[#eceef3] rounded-[20px] md:rounded-full px-6 py-2.5 flex items-center justify-around md:justify-end gap-6 shrink-0">
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] uppercase tracking-wider text-[#9E9E9E] font-medium font-sans">Founder axis</span>
                        <span className="text-[20px] font-bold text-[#0045FF] font-sans mt-0.5">{o.axes.founder?.score ?? "—"}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] uppercase tracking-wider text-[#9E9E9E] font-medium font-sans">Market axis</span>
                        <span className="text-[20px] font-bold text-[#0045FF] font-sans mt-0.5">{o.axes.market?.score ?? "—"}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] uppercase tracking-wider text-[#9E9E9E] font-medium font-sans">Idea axis</span>
                        <span className="text-[20px] font-bold text-[#0045FF] font-sans mt-0.5">{o.axes.idea_vs_market?.score ?? "—"}</span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

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

function QuickAction({ href, title, sub }: { href: string; title: string; sub: string }) {
  return (
    <Link href={href} className="group border border-line bg-[#F8F9FA] rounded-2xl px-4 py-3.5 transition-colors hover:border-[#0045FF] flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <span className="font-sans text-[13px] font-bold text-ink">{title}</span>
          <span className="text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-[#0045FF]">→</span>
        </div>
        <p className="mt-1 text-[11.5px] text-muted font-sans leading-relaxed">{sub}</p>
      </div>
    </Link>
  );
}

function SourcingGraph({ nodes }: { nodes: GraphNode[] }) {
  const uniqueNodes = Array.from(new Map(nodes.map((n) => [n.id, n])).values());

  if (uniqueNodes.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-[12px] text-faint border border-line bg-cardalt rounded-2xl">
        No relationships in sourcing graph yet — scan for candidates.
      </div>
    );
  }

  const width = 450;
  const height = 280;
  const cx = width / 2;
  const cy = height / 2;

  // Distinct institutions
  const institutions = Array.from(new Set(uniqueNodes.map((n) => n.institutionName)));
  const instCoords = new Map<string, { x: number; y: number }>();
  
  institutions.forEach((inst, index) => {
    const angle = (index * 2 * Math.PI) / institutions.length;
    const r = 55;
    instCoords.set(inst, {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
  });

  // Position nodes
  const nodeCoords = uniqueNodes.map((n, index) => {
    const instCoord = instCoords.get(n.institutionName) || { x: cx, y: cy };
    const angle = (index * 2 * Math.PI) / uniqueNodes.length;
    const r = 110;
    return {
      ...n,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      ix: instCoord.x,
      iy: instCoord.y,
    };
  });

  return (
    <div className="bg-[#F8F8F8] rounded-[24px] p-6 shadow-none h-full flex flex-col justify-between border-0">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted font-bold mb-4 border-b border-line pb-2 flex items-center justify-between">
        <span>Sourcing Graph Network (Stretch 3)</span>
        <span className="text-accent flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
          Live Moat
        </span>
      </div>
      <div className="relative flex justify-center overflow-hidden">
        <svg width={width} height={height} className="overflow-visible">
          {/* Central Hub */}
          <circle cx={cx} cy={cy} r="14" fill="#0045ff" className="animate-pulse opacity-15" />
          <circle cx={cx} cy={cy} r="8" fill="#0045ff" />
          
          {/* Edges from Center to Institutions */}
          {Array.from(instCoords.entries()).map(([name, coords]) => (
            <line
              key={`c-${name}`}
              x1={cx}
              y1={cy}
              x2={coords.x}
              y2={coords.y}
              stroke="rgba(0, 69, 255, 0.12)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          ))}

          {/* Edges from Institutions to Companies */}
          {nodeCoords.map((n) => (
            <path
              key={`edge-${n.id}`}
              d={`M ${n.ix} ${n.iy} Q ${(n.ix + n.x)/2} ${(n.iy + n.y)/2 - 15} ${n.x} ${n.y}`}
              fill="none"
              stroke="rgba(0, 69, 255, 0.15)"
              strokeWidth="1.5"
            />
          ))}

          {/* Institution Nodes */}
          {Array.from(instCoords.entries()).map(([name, coords]) => (
            <g key={`inst-${name}`}>
              <circle cx={coords.x} cy={coords.y} r="10" fill="#f1f3f7" stroke="#dcdfe8" strokeWidth="1" />
              <circle cx={coords.x} cy={coords.y} r="5" fill="#0045ff" />
              <text
                x={coords.x}
                y={coords.y - 12}
                textAnchor="middle"
                className="font-mono text-[9px] font-bold fill-muted"
              >
                {name}
              </text>
            </g>
          ))}

          {/* Company Nodes */}
          {nodeCoords.map((n) => (
            <g key={`comp-${n.id}`} className="group cursor-pointer">
              <circle cx={n.x} cy={n.y} r="6" fill="#12a150" className="group-hover:scale-125 transition-transform" />
              <text
                x={n.x}
                y={n.y + 14}
                textAnchor="middle"
                className="font-mono text-[8px] fill-ink font-bold opacity-80 group-hover:opacity-100"
              >
                {n.companyName}
              </text>
              <title>{`${n.founderName} @ ${n.companyName} (${n.programName})`}</title>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function IconNetwork() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <circle cx="18" cy="6" r="3" />
      <line x1="6" y1="9" x2="18" y2="15" />
      <line x1="18" y1="9" x2="18" y2="15" />
      <line x1="6" y1="6" x2="15" y2="6" />
    </svg>
  );
}

function IconRadar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a10 10 0 1 0 10 10" />
      <path d="M12 12L2.5 9.5" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconDatabase() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
