"use client";
/**
 * Calibration console — the complete signup + fund-calibration flow.
 *
 * Design: NOT the reference prototype's card-and-rail. A split console:
 * questions on the left, and on the right a live THESIS.SPEC panel that
 * compiles in real time as you answer — the product's core promise (your lens
 * drives the machine) made visible from the first keystroke. Steps are
 * validation-gated; the final step reviews everything and launches atomically:
 * account → thesis → first radar sweep.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Thesis, ThesisProfile } from "@/lib/services/thesis";
import { api, postJson } from "./api";
import { Chip, Spinner, inputCls, labelCls } from "./ui";
import {
  ARCHETYPE_OPTIONS,
  DEFAULT_DRAFT,
  GEO_OPTIONS,
  SECTOR_OPTIONS,
  SOURCE_OPTIONS,
  STAGE_OPTIONS,
  type ThesisDraft,
  deriveAxisWeights,
  draftFromThesis,
  thesisPayload,
} from "./thesisOptions";

export type WizardMode = "signup" | "recalibrate";

type Account = { name: string; email: string; password: string };
type Identity = { role: string; decisionAuthority: "sole_gp" | "ic_required" | "advisory"; fundName: string; fundSize: string };

const STEPS = [
  { id: "you", n: "01", label: "You" },
  { id: "fund", n: "02", label: "Fund" },
  { id: "lens", n: "03", label: "Lens" },
  { id: "founder", n: "04", label: "Founders" },
  { id: "signals", n: "05", label: "Signals" },
  { id: "launch", n: "06", label: "Launch" },
] as const;

const KEY = "vcb.calibration.v2";
const AUTHORITY: [Identity["decisionAuthority"], string, string][] = [
  ["sole_gp", "Sole GP", "you sign the check"],
  ["ic_required", "IC required", "committee co-signs"],
  ["advisory", "Advisory", "you recommend"],
];

export default function CalibrationWizard({ mode }: { mode: WizardMode }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [maxVisited, setMaxVisited] = useState(0);
  const [account, setAccount] = useState<Account>({ name: "", email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [identity, setIdentity] = useState<Identity>({ role: "General Partner", decisionAuthority: "sole_gp", fundName: "", fundSize: "" });
  const [draft, setDraft] = useState<ThesisDraft>({ ...DEFAULT_DRAFT, notes: "" });
  const [confirmed, setConfirmed] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [booted, setBooted] = useState(mode === "signup");
  // A calibrated workspace already exists → new signups JOIN it as team
  // members instead of overwriting the first investor's thesis.
  const [existing, setExisting] = useState<{ workspaceName?: string; calibratedBy?: string | null } | null>(null);
  const joinMode = mode === "signup" && existing !== null;

  /* ------------------------------ persistence ------------------------------ */
  // Draft autosaves locally — the password NEVER touches storage.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.account) setAccount((a) => ({ ...a, name: s.account.name ?? "", email: s.account.email ?? "" }));
        if (s.identity) setIdentity((i) => ({ ...i, ...s.identity }));
        if (s.draft) setDraft((d) => ({ ...d, ...s.draft }));
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ account: { name: account.name, email: account.email }, identity, draft })
      );
    } catch {}
  }, [account.name, account.email, identity, draft]);

  // Recalibrate mode: prefill from the signed-in account + committed thesis.
  useEffect(() => {
    if (mode !== "recalibrate") return;
    Promise.all([
      api<{ user: { name: string; email: string } | null }>("/api/auth/me").catch(() => ({ user: null })),
      api<{ active: Thesis | null }>("/api/thesis").catch(() => ({ active: null })),
    ])
      .then(([me, t]) => {
        if (me.user) setAccount((a) => ({ ...a, name: me.user!.name, email: me.user!.email }));
        if (t.active) {
          setDraft(draftFromThesis(t.active));
          const p = (t.active.profileJson ?? {}) as ThesisProfile;
          setIdentity((i) => ({
            ...i,
            role: p.gpRole ?? i.role,
            decisionAuthority: p.decisionAuthority ?? i.decisionAuthority,
            fundName: p.fundName ?? "",
            fundSize: p.fundSize ?? "",
          }));
        }
      })
      .finally(() => setBooted(true));
  }, [mode]);

  // Signup mode: if already signed in, this is a recalibration — move over.
  // Also detect an already-calibrated workspace (join, don't stomp).
  useEffect(() => {
    if (mode !== "signup") return;
    api<{ user: unknown }>("/api/auth/me")
      .then((r) => {
        if (r.user) router.replace("/onboarding");
      })
      .catch(() => {});
    api<{ hasWorkspace: boolean; workspaceName?: string; calibratedBy?: string | null }>("/api/auth/status")
      .then((r) => {
        if (r.hasWorkspace) setExisting({ workspaceName: r.workspaceName, calibratedBy: r.calibratedBy });
      })
      .catch(() => {});
  }, [mode, router]);

  async function joinWorkspace() {
    if (stepCheck(0) !== null) return;
    setLaunching(true);
    setErr(null);
    try {
      await postJson("/api/auth/signup", {
        name: account.name.trim(),
        email: account.email.trim(),
        password: account.password,
      });
      try {
        localStorage.removeItem(KEY);
      } catch {}
      router.push("/dashboard");
    } catch (e) {
      setErr((e as Error).message);
      setLaunching(false);
    }
  }

  /* ------------------------------- validation ------------------------------ */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const stepCheck = useCallback(
    (i: number): string | null => {
      switch (STEPS[i].id) {
        case "you":
          if (account.name.trim().length < 2) return "Add your full name.";
          if (!EMAIL_RE.test(account.email.trim())) return "A valid work email is required — memos are delivered to it.";
          if (mode === "signup" && account.password.length < 8) return "Password needs at least 8 characters.";
          if (!identity.role.trim()) return "Add your role.";
          return null;
        case "fund":
          if (draft.checkSizeMinUsd <= 0 || draft.checkSizeMaxUsd <= 0) return "Set a check size range.";
          if (draft.checkSizeMinUsd > draft.checkSizeMaxUsd) return "Check minimum can't exceed the maximum.";
          if (draft.stages.length === 0) return "Pick at least one stage.";
          if (draft.geographies.length === 0) return "Pick at least one geography.";
          return null;
        case "lens":
          if (draft.sectors.length === 0) return "Pick at least one sector — the radar needs a direction.";
          return null;
        case "founder":
          return null; // archetypes are a bias, not a requirement
        case "signals":
          if (draft.enabledSources.length === 0) return "Turn on at least one source.";
          return null;
        case "launch":
          if (!confirmed) return "Tick the confirmation box to launch.";
          return null;
      }
      return null;
    },
    [account, identity, draft, confirmed, mode]
  );
  const currentIssue = stepCheck(step);
  const canContinue = currentIssue === null;

  const go = (i: number) => {
    if (i > step && !canContinue) return;
    const clamped = Math.max(0, Math.min(STEPS.length - 1, i));
    if (clamped > maxVisited && clamped - maxVisited > 1) return;
    setErr(null);
    setStep(clamped);
    setMaxVisited((m) => Math.max(m, clamped));
    window.scrollTo({ top: 0 });
  };

  /* --------------------------------- launch -------------------------------- */
  async function launch() {
    if (!canContinue) return;
    setLaunching(true);
    setErr(null);
    try {
      if (mode === "signup") {
        await postJson("/api/auth/signup", {
          name: account.name.trim(),
          email: account.email.trim(),
          password: account.password,
        });
      }
      const name =
        identity.fundName.trim() ||
        `${draft.stages[0] ?? "early"} ${draft.sectors[0] ?? "AI"} (${draft.geographies.slice(0, 2).join(" + ") || "global"})`;
      const profileExtras: ThesisProfile = {
        gpName: account.name.trim(),
        gpRole: identity.role.trim() || undefined,
        gpEmail: account.email.trim(),
        decisionAuthority: identity.decisionAuthority,
        fundName: identity.fundName.trim() || undefined,
        fundSize: identity.fundSize.trim() || undefined,
        onboardedAt: new Date().toISOString(),
      };
      // Recalibration archives unassessed radar hypotheses from the previous lens.
      await postJson("/api/thesis", {
        ...thesisPayload({ ...draft, name }, profileExtras),
        archiveStale: mode === "recalibrate",
      });
      // Hand off to the command center: it runs the first search visibly,
      // with per-source progress and results streaming in one by one.
      try {
        localStorage.removeItem(KEY);
        localStorage.setItem("vcb.autopilot.target", "10"); // fully check the first 10
        localStorage.setItem("vcb.sweep.request", "1");
      } catch {}
      router.push("/dashboard");
    } catch (e) {
      setErr((e as Error).message);
      setLaunching(false);
    }
  }

  /* ------------------------------- derived UI ------------------------------ */
  const weights = useMemo(() => deriveAxisWeights(draft.riskScore, draft.traits), [draft.riskScore, draft.traits]);
  const pct = Math.round(((step + (canContinue ? 1 : 0.4)) / STEPS.length) * 100);

  if (!booted)
    return (
      <div className="grid min-h-screen place-items-center bg-paper">
        <Spinner label="Loading calibration…" />
      </div>
    );

  const setD = (patch: Partial<ThesisDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const toggle = (k: "sectors" | "stages" | "geographies" | "archetypes" | "enabledSources", v: string) =>
    setDraft((d) => ({ ...d, [k]: d[k].includes(v) ? d[k].filter((x) => x !== v) : [...d[k], v] }));

  return (
    <div className="min-h-screen bg-paper">
      {/* Console header */}
      <header className="sticky top-0 z-40 border-b border-line bg-card">
        <div className="flex h-12 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center bg-accent text-accentink">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M9 1 3 9h4l-1 6 6-8H8l1-6z" />
              </svg>
            </span>
            <span className="font-mono text-[13px] font-bold tracking-wide">VC.BRAIN</span>
            <span className="ml-2 hidden font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint sm:inline">
              {mode === "signup" ? "Calibration console" : "Recalibration"}
            </span>
          </Link>
          {mode === "signup" ? (
            <Link href="/signin" className="font-mono text-[11.5px] text-muted hover:text-ink">
              Have an account? Sign in →
            </Link>
          ) : (
            <Link href="/dashboard" className="font-mono text-[11.5px] text-muted hover:text-ink">
              ← Back to command center
            </Link>
          )}
        </div>
        <div className="h-[3px] w-full bg-line">
          <div className="h-full bg-accent transition-all duration-300" style={{ width: `${Math.max(4, Math.min(100, pct))}%` }} />
        </div>
        {/* Step breadcrumbs */}
        <div className="flex items-center gap-0 overflow-x-auto border-t border-line bg-paper px-4 md:px-6">
          {(joinMode ? STEPS.slice(0, 1) : STEPS).map((s, i) => {
            const state = i === step ? "current" : i <= maxVisited ? "done" : "todo";
            return (
              <button
                key={s.id}
                onClick={() => (state !== "todo" ? go(i) : null)}
                disabled={state === "todo"}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 font-mono text-[11px] uppercase tracking-wide transition-colors ${
                  state === "current"
                    ? "border-accent text-accent"
                    : state === "done"
                      ? "border-transparent text-muted hover:text-ink"
                      : "border-transparent text-faint"
                }`}
              >
                <span className="tnum">{i < step ? "✓" : s.n}</span>
                {s.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Split console */}
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 md:px-6 lg:grid-cols-[1fr_320px] lg:py-14">
        {/* -------- questions column -------- */}
        <div className="min-w-0 max-w-2xl">
          {STEPS[step].id === "you" && (
            <StepShell
              n="01"
              title={joinMode ? "Join the workspace." : mode === "signup" ? "First — who signs the checks?" : "Who signs the checks?"}
              sub={
                joinMode
                  ? `“${existing?.workspaceName ?? "This workspace"}” is already calibrated${existing?.calibratedBy ? ` by ${existing.calibratedBy}` : ""} — you'll join it as a team member. The committed thesis stays untouched; recalibrate any time from the Thesis module.`
                  : "Every decision in this system terminates at a human. That human is you: the memo lands in your inbox, and nothing deploys without your click."
              }
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Full name">
                  <input value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} className={inputCls} placeholder="Lena Maschmeyer" autoComplete="name" />
                </Field>
                <Field label="Role">
                  <input value={identity.role} onChange={(e) => setIdentity({ ...identity, role: e.target.value })} className={inputCls} placeholder="General Partner" />
                </Field>
                <Field label="Work email" hint="sign-in + memo delivery">
                  <input value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} className={inputCls} placeholder="lena@fund.group" type="email" autoComplete="email" />
                </Field>
                {mode === "signup" ? (
                  <Field label="Password" hint="8+ characters">
                    <div className="relative">
                      <input
                        value={account.password}
                        onChange={(e) => setAccount({ ...account, password: e.target.value })}
                        className={`${inputCls} pr-14`}
                        type={showPw ? "text" : "password"}
                        autoComplete="new-password"
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10.5px] uppercase text-faint hover:text-ink"
                      >
                        {showPw ? "hide" : "show"}
                      </button>
                    </div>
                  </Field>
                ) : null}
              </div>
              <div className="mt-6">
                <div className="flex items-baseline justify-between">
                  <span className={labelCls}>Decision authority</span>
                  <span className="text-[10.5px] text-faint">calibrates how hard the system pushes for a decision</span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {AUTHORITY.map(([v, label, sub]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setIdentity({ ...identity, decisionAuthority: v })}
                      className={`border px-3.5 py-3 text-left transition-colors ${
                        identity.decisionAuthority === v ? "border-accent bg-wash" : "border-line bg-card hover:border-linestrong"
                      }`}
                    >
                      <div className={`font-mono text-[12.5px] font-bold ${identity.decisionAuthority === v ? "text-accent" : ""}`}>{label}</div>
                      <div className="mt-0.5 text-[11px] text-muted">{sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            </StepShell>
          )}

          {STEPS[step].id === "fund" && (
            <StepShell
              n="02"
              title="Draw the fund's boundaries."
              sub="Check size, stages and locations decide which founders we even show you."
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Fund name" hint="optional">
                  <input value={identity.fundName} onChange={(e) => setIdentity({ ...identity, fundName: e.target.value })} className={inputCls} placeholder="Maschmeyer Fund IV" />
                </Field>
                <Field label="Fund size" hint="optional">
                  <input value={identity.fundSize} onChange={(e) => setIdentity({ ...identity, fundSize: e.target.value })} className={inputCls} placeholder="€200M" />
                </Field>
                <Field label="Check min (USD)">
                  <input type="number" step={25_000} min={0} value={draft.checkSizeMinUsd} onChange={(e) => setD({ checkSizeMinUsd: Number(e.target.value) || 0 })} className={inputCls} />
                </Field>
                <Field label="Check max (USD)">
                  <input type="number" step={25_000} min={0} value={draft.checkSizeMaxUsd} onChange={(e) => setD({ checkSizeMaxUsd: Number(e.target.value) || 0 })} className={inputCls} />
                </Field>
              </div>
              <div className="mt-6">
                <div className="flex items-baseline justify-between">
                  <span className={labelCls}>Target ownership</span>
                  <span className="tnum font-mono text-[13px] font-bold text-accent">{draft.ownershipTargetPct}%</span>
                </div>
                <input type="range" min={1} max={20} step={0.5} value={draft.ownershipTargetPct} onChange={(e) => setD({ ownershipTargetPct: Number(e.target.value) })} className="mt-2 w-full accent-[#c44e1c]" />
                <p className="mt-1 text-[11px] text-faint">Drives the deploy button and dilution math in every memo.</p>
              </div>
              <ChipGroup label="Stage focus" options={STAGE_OPTIONS} selected={draft.stages} onToggle={(v) => toggle("stages", v)} />
              <ChipGroup label="Geographies" options={GEO_OPTIONS} selected={draft.geographies} onToggle={(v) => toggle("geographies", v)} hint="global-remote founders are always in scope" />
            </StepShell>
          )}

          {STEPS[step].id === "lens" && (
            <StepShell
              n="03"
              title="What do you invest in?"
              sub="Pick your sectors and set two dials. These become the live rules the system scores every founder against — watch your profile build on the right."
            >
              <ChipGroup label="Sectors" options={SECTOR_OPTIONS} selected={draft.sectors} onToggle={(v) => toggle("sectors", v)} hint="outside these = adjacent only" />
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <SliderField
                  label="Risk appetite"
                  left="Contrarian"
                  right="Consensus"
                  value={draft.riskScore}
                  onChange={(v) => setD({ riskScore: v })}
                  hint="contrarian = bet on people earlier; consensus = wait for proof"
                />
                <SliderField
                  label="Match threshold"
                  left="Broad"
                  right="Selective"
                  value={draft.convictionThreshold}
                  onChange={(v) => setD({ convictionThreshold: v })}
                  hint="founders scoring above this get fully checked automatically"
                />
              </div>
              <div className="mt-6">
                <div className="flex items-baseline justify-between">
                  <span className={labelCls}>Deal-breakers</span>
                  <span className="text-[10.5px] text-faint">plain English — enforced by every screening prompt</span>
                </div>
                <textarea
                  value={draft.notes}
                  onChange={(e) => setD({ notes: e.target.value })}
                  rows={3}
                  className={inputCls}
                  placeholder="No prior VC backing on pre-seed. English-fluent. Willing to relocate for ≥Series A."
                />
              </div>
            </StepShell>
          )}

          {STEPS[step].id === "founder" && (
            <StepShell
              n="04"
              title="Describe a fundable founder."
              sub="We use this picture to hunt — the search looks for people like this before they ever start raising."
            >
              <ChipGroup label="Archetypes" options={ARCHETYPE_OPTIONS} selected={draft.archetypes} onToggle={(v) => toggle("archetypes", v)} hint="optional, but sharper lens = sharper radar" />
              <div className="mt-6 space-y-5">
                {(
                  [
                    ["technicalDepth", "Technical depth", "can they build the hard thing"],
                    ["distributionInstinct", "Distribution instinct", "can they get it into hands"],
                    ["storytelling", "Storytelling", "can they make the world care"],
                  ] as const
                ).map(([k, label, sub]) => (
                  <div key={k}>
                    <div className="flex items-baseline justify-between">
                      <span className={labelCls}>{label}</span>
                      <span className="tnum font-mono text-[15px] font-bold text-accent">{draft.traits[k]}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={draft.traits[k]}
                      onChange={(e) => setD({ traits: { ...draft.traits, [k]: Number(e.target.value) } })}
                      className="mt-1.5 w-full accent-[#c44e1c]"
                    />
                    <p className="text-[11px] text-faint">{sub}</p>
                  </div>
                ))}
              </div>
            </StepShell>
          )}

          {STEPS[step].id === "signals" && (
            <StepShell
              n="05"
              title="Choose where we look."
              sub="Eight real, public sources. Turn on the ones you trust — more is not automatically better."
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {SOURCE_OPTIONS.map((s) => {
                  const on = draft.enabledSources.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle("enabledSources", s.id)}
                      className={`flex items-center justify-between gap-3 border px-3.5 py-3 text-left transition-colors ${
                        on ? "border-accent bg-wash" : "border-line bg-card hover:border-linestrong"
                      }`}
                    >
                      <div>
                        <div className={`font-mono text-[12.5px] font-bold ${on ? "text-accent" : ""}`}>
                          {on ? "◉ " : "○ "}
                          {s.label}
                        </div>
                        <div className="mt-0.5 font-mono text-[10.5px] text-faint">{s.est}</div>
                      </div>
                      <span
                        className={`border px-1.5 py-px font-mono text-[10.5px] uppercase ${
                          s.trust === "high" ? "border-ok/40 bg-okwash text-ok" : "border-warn/40 bg-warnwash text-warn"
                        }`}
                      >
                        {s.trust}
                      </span>
                    </button>
                  );
                })}
              </div>
            </StepShell>
          )}

          {STEPS[step].id === "launch" && (
            <StepShell
              n="06"
              title="Check it. Then launch."
              sub="This is everything the system will use to find, check and score founders for you. Edit any line before you launch."
            >
              <div className="divide-y divide-line border border-line bg-card">
                <ReviewRow label="Investor" value={`${account.name || "—"} · ${identity.role}${mode === "signup" ? ` · ${account.email || "—"}` : ""}`} onEdit={() => go(0)} />
                <ReviewRow
                  label="Authority"
                  value={AUTHORITY.find(([v]) => v === identity.decisionAuthority)?.[1] ?? "—"}
                  onEdit={() => go(0)}
                />
                <ReviewRow
                  label="Fund"
                  value={`${[identity.fundName, identity.fundSize].filter(Boolean).join(" · ") || "unnamed"} · $${fmtK(draft.checkSizeMinUsd)}–$${fmtK(draft.checkSizeMaxUsd)} for ${draft.ownershipTargetPct}%`}
                  onEdit={() => go(1)}
                />
                <ReviewRow label="Stages · geos" value={`${draft.stages.join(", ") || "—"} · ${draft.geographies.join(", ") || "—"}`} onEdit={() => go(1)} />
                <ReviewRow label="Sectors" value={draft.sectors.join(" · ") || "—"} onEdit={() => go(2)} />
                <ReviewRow
                  label="Posture"
                  value={`risk ${draft.riskScore}/100 · auto-check founders scoring ≥ ${draft.convictionThreshold}`}
                  onEdit={() => go(2)}
                />
                <ReviewRow label="Non-negotiables" value={draft.notes || "none set"} onEdit={() => go(2)} />
                <ReviewRow
                  label="Founder lens"
                  value={`${draft.archetypes.join(", ") || "no archetypes"} · depth ${draft.traits.technicalDepth} / distribution ${draft.traits.distributionInstinct} / story ${draft.traits.storytelling}`}
                  onEdit={() => go(3)}
                />
                <ReviewRow label="Sources" value={`${draft.enabledSources.length}/8 on — ${draft.enabledSources.join(", ")}`} onEdit={() => go(4)} />
              </div>

              <label className="mt-5 flex cursor-pointer items-start gap-2.5 border border-line bg-card px-3.5 py-3">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 accent-[#c44e1c]" />
                <span className="text-[12.5px] leading-snug text-muted">
                  I understand the system <strong className="text-ink">finds, checks and drafts</strong> on its own — but{" "}
                  <strong className="text-ink">never invests a dollar without my confirmation</strong>.
                </span>
              </label>

              {err ? (
                <p className="mt-3 border border-bad/40 bg-badwash px-3 py-2 text-[12px] text-bad">
                  {err}
                  {err.toLowerCase().includes("exists") ? (
                    <>
                      {" "}
                      <Link href="/signin" className="underline">
                        Sign in instead →
                      </Link>
                    </>
                  ) : null}
                </p>
              ) : null}
            </StepShell>
          )}

          {/* Footer controls */}
          <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
            <button
              onClick={() => go(step - 1)}
              disabled={step === 0}
              className="border border-line bg-card px-3.5 py-2 font-mono text-[12px] uppercase tracking-wide text-muted hover:text-ink disabled:opacity-40"
            >
              ← Back
            </button>
            <span className="hidden font-mono text-[10.5px] text-faint sm:inline">
              {currentIssue && step < STEPS.length - 1 ? currentIssue : "autosaved locally"}
            </span>
            {joinMode ? (
              <div className="flex flex-col items-end gap-1.5">
                <button
                  onClick={joinWorkspace}
                  disabled={!canContinue || launching}
                  className="bg-accent px-4 py-2 font-mono text-[12px] font-semibold uppercase tracking-wide text-accentink hover:opacity-90 disabled:opacity-40"
                >
                  {launching ? "Creating account…" : "Create account & join →"}
                </button>
                {err ? <span className="max-w-xs text-right text-[11px] text-bad">{err}</span> : null}
              </div>
            ) : step < STEPS.length - 1 ? (
              <button
                onClick={() => go(step + 1)}
                disabled={!canContinue}
                className="bg-accent px-4 py-2 font-mono text-[12px] font-semibold uppercase tracking-wide text-accentink hover:opacity-90 disabled:opacity-40"
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={launch}
                disabled={!canContinue || launching}
                className="bg-ok px-4 py-2 font-mono text-[12px] font-bold uppercase tracking-wide text-white hover:opacity-90 disabled:opacity-40"
              >
                {launching ? "Saving profile…" : mode === "signup" ? "⚡ Create account & start the search" : "⚡ Save & search again"}
              </button>
            )}
          </div>
        </div>

        {/* -------- live spec panel -------- */}
        <SpecPanel
          account={account}
          identity={identity}
          draft={draft}
          weights={weights}
          mode={mode}
          stepId={STEPS[step].id}
        />
      </div>
    </div>
  );
}

/* ------------------------------ live spec panel ----------------------------- */
function SpecPanel({
  account,
  identity,
  draft,
  weights,
  mode,
  stepId,
}: {
  account: Account;
  identity: Identity;
  draft: ThesisDraft;
  weights: { founder: number; market: number; idea: number };
  mode: WizardMode;
  stepId: string;
}) {

  const lines: [string, string, boolean][] = [
    ["gp", account.name ? `${account.name}${identity.role ? ` · ${identity.role.toLowerCase()}` : ""}` : "", !!account.name],
    ["auth", identity.decisionAuthority.replace("_", " "), true],
    [
      "fund",
      [identity.fundName, identity.fundSize].filter(Boolean).join(" · ") || "",
      !!(identity.fundName || identity.fundSize),
    ],
    ["check", `$${fmtK(draft.checkSizeMinUsd)}–$${fmtK(draft.checkSizeMaxUsd)} · ${draft.ownershipTargetPct}% target`, draft.checkSizeMinUsd > 0],
    ["stages", draft.stages.join(", "), draft.stages.length > 0],
    ["geo", draft.geographies.join(", "), draft.geographies.length > 0],
    ["sectors", draft.sectors.join(", "), draft.sectors.length > 0],
    ["risk", `${draft.riskScore}/100 · threshold ≥${draft.convictionThreshold}`, true],
    ["lens", draft.archetypes.join(", "), draft.archetypes.length > 0],
    ["rules", draft.notes, !!draft.notes.trim()],
    ["sources", `${draft.enabledSources.length}/8 on`, draft.enabledSources.length > 0],
  ];
  const filled = lines.filter(([, , on]) => on).length;

  return (
    <aside className="lg:sticky lg:top-[104px] h-fit">
      <div className="border border-linestrong bg-ink text-paper">
        <div className="flex items-center justify-between border-b border-paper/15 px-4 py-2.5">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-paper/60">your profile</span>
          <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase text-paper/60">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            building
          </span>
        </div>
        <div className="space-y-1 px-4 py-3.5 font-mono text-[11.5px] leading-relaxed">
          {lines.map(([k, v, on]) => (
            <div key={k} className={`flex gap-2 ${on ? "" : "opacity-30"}`}>
              <span className="w-[64px] shrink-0 text-paper/50">{k}</span>
              <span className="min-w-0 break-words text-paper/90">{on ? v : "—"}</span>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <span className="w-[64px] shrink-0 text-paper/50">status</span>
            <span className="text-accent">
              {stepId === "launch" ? "ready to launch" : `${filled}/${lines.length} answered`}
              <span className="animate-pulse">▌</span>
            </span>
          </div>
        </div>
        <div className="border-t border-paper/15 px-4 py-3">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.15em] text-paper/50">Axis weighting</div>
          <div className="mt-2 space-y-1.5">
            {(
              [
                ["founder", weights.founder],
                ["market", weights.market],
                ["idea", weights.idea],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 font-mono text-[10.5px]">
                <span className="w-[64px] shrink-0 text-paper/50">{k}</span>
                <div className="h-1 flex-1 bg-paper/15">
                  <div className="h-full bg-accent transition-all" style={{ width: `${v * 180}%` }} />
                </div>
                <span className="tnum w-8 text-right text-paper/80">{v.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 hidden text-center font-mono text-[10.5px] text-faint lg:block">
        {mode === "signup" ? "Launch creates your account, saves your profile, and starts the search." : "Launch saves the profile and starts a fresh search."}
      </p>
    </aside>
  );
}

/* --------------------------------- helpers --------------------------------- */
function fmtK(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` : `${Math.round(n / 1000)}K`;
}

function StepShell({ n, title, sub, children }: { n: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="font-mono text-[11px] font-bold text-accent">{n} /</div>
      <h1 className="mt-1.5 font-mono text-[clamp(22px,3.2vw,30px)] font-bold leading-tight tracking-tight">{title}</h1>
      <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">{sub}</p>
      <div className="mt-7">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className={labelCls}>{label}</label>
        {hint ? <span className="text-[10.5px] text-faint">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function ChipGroup({
  label,
  options,
  selected,
  onToggle,
  hint,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onToggle: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between">
        <span className={labelCls}>{label}</span>
        {hint ? <span className="text-[10.5px] text-faint">{hint}</span> : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <Chip key={o} active={selected.includes(o)} onClick={() => onToggle(o)}>
            {o}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function SliderField({
  label,
  left,
  right,
  value,
  onChange,
  hint,
}: {
  label: string;
  left: string;
  right: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className={labelCls}>{label}</span>
        <span className="tnum font-mono text-[13px] font-bold text-accent">{value}</span>
      </div>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-[#c44e1c]" />
      <div className="flex justify-between font-mono text-[10.5px] text-faint">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      {hint ? <p className="mt-1 text-[11px] text-faint">{hint}</p> : null}
    </div>
  );
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.15em] text-faint">{label}</div>
        <div className="mt-0.5 text-[12.5px] leading-snug">{value}</div>
      </div>
      <button onClick={onEdit} className="shrink-0 font-mono text-[10.5px] uppercase tracking-wide text-accent hover:underline">
        edit
      </button>
    </div>
  );
}
