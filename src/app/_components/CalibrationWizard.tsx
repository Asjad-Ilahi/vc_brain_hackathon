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
  const [booted, setBooted] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  // A calibrated workspace already exists → new signups JOIN it as team
  // members instead of overwriting the first investor's thesis.
  const [existing, setExisting] = useState<{ workspaceName?: string; calibratedBy?: string | null } | null>(null);
  const joinMode = mode === "signup" && existing !== null;

  const STEPS = mode === "signup"
    ? [
        { id: "you",     n: "01", label: "You" },
        { id: "fund",    n: "02", label: "Fund" },
        { id: "lens",    n: "03", label: "Lens" },
        { id: "founder", n: "04", label: "Founders" },
        { id: "signals", n: "05", label: "Signals" },
        { id: "account", n: "06", label: "Account" },
        { id: "launch",  n: "07", label: "Launch" },
      ] as const
    : [
        { id: "you",     n: "01", label: "You" },
        { id: "fund",    n: "02", label: "Fund" },
        { id: "lens",    n: "03", label: "Lens" },
        { id: "founder", n: "04", label: "Founders" },
        { id: "signals", n: "05", label: "Signals" },
        { id: "launch",  n: "06", label: "Launch" },
      ] as const;

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
    Promise.all([
      api<{ user: unknown; onboarded: boolean }>("/api/auth/me")
        .then((r) => {
          if (r.user && r.onboarded) {
            // Fully signed in and onboarded → dashboard
            router.replace("/dashboard");
          }
          // Signed in but not yet onboarded → let them continue through the wizard
        })
        .catch(() => {}),
      api<{ hasWorkspace: boolean; workspaceName?: string; calibratedBy?: string | null }>("/api/auth/status")
        .then(async (r) => {
          if (r.hasWorkspace) {
            setExisting({ workspaceName: r.workspaceName, calibratedBy: r.calibratedBy });
            try {
              const t = await api<{ active: Thesis | null }>("/api/thesis");
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
            } catch {}
          }
        })
        .catch(() => {}),
    ]).finally(() => {
      setBooted(true);
    });
  }, [mode, router]);

  // signUpAndContinue removed since account creation is delayed to the final step

  /* ------------------------------- validation ------------------------------ */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const stepCheck = useCallback(
    (i: number): string | null => {
      switch (STEPS[i].id) {
        case "you":
          if (account.name.trim().length < 2) return "Add your full name.";
          if (!EMAIL_RE.test(account.email.trim())) return "A valid work email is required — memos are delivered to it.";
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
          return null;
        case "signals":
          if (draft.enabledSources.length === 0) return "Turn on at least one source.";
          return null;
        case "account":
          if (!EMAIL_RE.test(account.email.trim())) return "A valid work email is required.";
          if (account.password.length < 8) return "Password must be at least 8 characters.";
          if (account.password !== confirmPassword) return "Passwords do not match.";
          return null;
        case "launch":
          if (!confirmed) return "Tick the confirmation box to launch.";
          return null;
      }
      return null;
    },
    [account, identity, draft, confirmed, confirmPassword, mode]
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
      // Step 1: Create the account (signup mode only)
      if (mode === "signup") {
        await postJson("/api/auth/signup", {
          name: account.name.trim(),
          email: account.email.trim(),
          password: account.password,
        });
      }
      // Step 2: Save the thesis calibration
      if (!joinMode) {
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
        await postJson("/api/thesis", {
          ...thesisPayload({ ...draft, name }, profileExtras),
          archiveStale: mode === "recalibrate",
        });
      }
      try { localStorage.removeItem(KEY); } catch {}
      router.push("/signup/loading");
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
    <div className="min-h-screen bg-paper font-sans">
      {/* Sticky Progress Line */}
      <div className="sticky top-0 z-40 h-[3px] w-full bg-line">
        <div className="h-full bg-accent transition-all duration-300" style={{ width: `${Math.max(4, Math.min(100, pct))}%` }} />
      </div>

      {/* Center Console */}
      <div className="mx-auto max-w-[960px] px-6 pt-12 pb-36 md:pt-16 md:pb-40">
        <div className="min-w-0">
          {STEPS[step].id === "you" && (
            <StepShell
              n={STEPS[step].n}
              total={STEPS.length}
              title={joinMode ? "Join the workspace." : mode === "signup" ? "Welcome. Let's meet you first" : "Welcome. Let's meet you first"}
              sub={
                joinMode
                  ? `“${existing?.workspaceName ?? "This workspace"}” is already calibrated${existing?.calibratedBy ? ` by ${existing.calibratedBy}` : ""} — you'll join it as a team member. The committed thesis stays untouched; recalibrate any time from the Thesis module.`
                  : "This is the human on the other side of every decision. The system will never deploy without your confirmation."
              }
            >
              <div className="grid gap-y-10 gap-x-12 md:grid-cols-2">
                <Field label="Full Name">
                  <input value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} className={inputCls} placeholder="Enter your name" autoComplete="name" />
                </Field>
                <Field label="Role">
                  <input value={identity.role} onChange={(e) => setIdentity({ ...identity, role: e.target.value })} className={inputCls} placeholder="Enter your role" />
                </Field>
                <Field label="Work Email" hint="Used for memo delivery">
                  <input value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} className={inputCls} placeholder="Enter your work email" type="email" autoComplete="email" />
                </Field>

                <div className="mb-4">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <label className="block font-sans text-[12px] font-bold text-[#000000]">Decision Authority</label>
                    <span className="text-[11px] text-[#6E6E6E] font-sans">Who signs the check?</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2.5">
                    {AUTHORITY.map(([v, label]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setIdentity({ ...identity, decisionAuthority: v })}
                        className={`rounded-full px-6 py-3.5 text-center text-[13px] font-semibold transition-all ${
                          identity.decisionAuthority === v ? "bg-[#0045FF] text-white" : "bg-[#F8F8F8] text-[#000000] hover:bg-[#eee]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Password field removed from Step 1 */}
              </div>
            </StepShell>
          )}

          {STEPS[step].id === "fund" && (
            <StepShell
              n={STEPS[step].n}
              total={STEPS.length}
              title="Fund parameters."
              sub="Sets the boundaries — check sizes, stages, and geographies determine what the radar even surfaces."
            >
              <div className="space-y-8">
                {/* Row 1: Fund Name & Fund Size */}
                <div className="grid gap-y-6 gap-x-12 md:grid-cols-2">
                  <Field label="Fund Name">
                    <input value={identity.fundName} onChange={(e) => setIdentity({ ...identity, fundName: e.target.value })} className={inputCls} placeholder="Enter the name of your fund" />
                  </Field>
                  <Field label="Fund Size">
                    <SelectField
                      value={identity.fundSize}
                      onChange={(val) => setIdentity({ ...identity, fundSize: val })}
                      options={[
                        { label: "10M$", value: "10M$" },
                        { label: "25M$", value: "25M$" },
                        { label: "50M$", value: "50M$" },
                        { label: "100M$", value: "100M$" },
                        { label: "200M$", value: "200M$" },
                        { label: "500M$", value: "500M$" },
                        { label: "1B$", value: "1B$" },
                      ]}
                    />
                  </Field>
                </div>

                {/* Row 2: Check Size Range & Target Ownership */}
                <div className="grid gap-y-6 gap-x-12 md:grid-cols-2">
                  <div>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <label className="block font-sans text-[12px] font-bold text-[#000000]">Check size range</label>
                    </div>
                    <div className="flex gap-4">
                      <SelectField
                        value={draft.checkSizeMinUsd}
                        onChange={(val) => setD({ checkSizeMinUsd: Number(val) })}
                        options={[
                          { label: "$ 25K", value: 25000 },
                          { label: "$ 50K", value: 50000 },
                          { label: "$ 100K", value: 100000 },
                          { label: "$ 250K", value: 250000 },
                          { label: "$ 500K", value: 500000 },
                          { label: "$ 1M", value: 1000000 },
                        ]}
                      />
                      <SelectField
                        value={draft.checkSizeMaxUsd}
                        onChange={(val) => setD({ checkSizeMaxUsd: Number(val) })}
                        options={[
                          { label: "$ 100K", value: 100000 },
                          { label: "$ 250K", value: 250000 },
                          { label: "$ 500K", value: 500000 },
                          { label: "$ 1M", value: 1000000 },
                          { label: "$ 2M", value: 2000000 },
                          { label: "$ 5M", value: 5000000 },
                          { label: "$ 10M", value: 10000000 },
                        ]}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="block font-sans text-[12px] font-bold text-[#000000]">Target ownership</span>
                    </div>
                    <div className="relative mt-2">
                      <input
                        type="range"
                        min={1}
                        max={20}
                        step={0.5}
                        value={draft.ownershipTargetPct}
                        onChange={(e) => setD({ ownershipTargetPct: Number(e.target.value) })}
                        className="w-full h-1 bg-[#F0F0F0] rounded-lg appearance-none cursor-pointer accent-[#0045FF] slider-input"
                        style={{ background: `linear-gradient(to right, #0045FF ${((draft.ownershipTargetPct - 1) / (20 - 1)) * 100}%, #F0F0F0 ${((draft.ownershipTargetPct - 1) / (20 - 1)) * 100}%)` }}
                      />
                      <div className="flex justify-between text-[11px] text-[#6E6E6E] mt-1.5 font-sans">
                        <span>1%</span>
                        <span className="text-[#0045FF] font-semibold">{draft.ownershipTargetPct}%</span>
                        <span>20%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 3: Stage Focus & Geographies */}
                <div className="grid gap-y-6 gap-x-12 md:grid-cols-2">
                  <div className="-mt-6">
                    <ChipGroup label="Stage focus" options={STAGE_OPTIONS} selected={draft.stages} onToggle={(v) => toggle("stages", v)} />
                  </div>
                  <div className="-mt-6">
                    <ChipGroup label="Geographies" options={GEO_OPTIONS} selected={draft.geographies} onToggle={(v) => toggle("geographies", v)} hint="global-remote founders always in scope" />
                  </div>
                </div>
              </div>
            </StepShell>
          )}

          {STEPS[step].id === "lens" && (
            <StepShell
              n={STEPS[step].n}
              total={STEPS.length}
              title="Encode your investment lens."
              sub="These sliders and sectors become live weights in the scoring pipeline. You can recalibrate any time."
            >
              <div className="grid gap-y-10 gap-x-12 md:grid-cols-2">
                {/* Left Column */}
                <div className="space-y-8">
                  <ChipGroup label="Sectors" options={SECTOR_OPTIONS} selected={draft.sectors} onToggle={(v) => toggle("sectors", v)} hint="outside these = adjacent only" />
                  <div className="mb-4">
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="block font-sans text-[12px] font-bold text-[#000000]">Non-negotiables</span>
                      <span className="text-[11px] text-[#6E6E6E] font-sans">plain English — enforced by screening</span>
                    </div>
                    <textarea
                      value={draft.notes}
                      onChange={(e) => setD({ notes: e.target.value })}
                      rows={5}
                      className="w-full rounded-2xl border-0 bg-[#F8F8F8] px-6 py-4.5 text-[14px] text-[#000000] outline-none placeholder-[#a0a0a0] transition-colors focus:bg-[#f0f0f0]"
                      placeholder="Enter your non negotiables in plain english"
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-8">
                  <SliderField
                    label="Risk appetite"
                    left="Contrarian"
                    right="Consensus"
                    value={draft.riskScore}
                    onChange={(v) => setD({ riskScore: v })}
                    hint="contrarian = bet on people earlier; consensus = wait for proof"
                  />
                  <SliderField
                    label="Conviction threshold"
                    left="Broad"
                    right="Selective"
                    value={draft.convictionThreshold}
                    onChange={(v) => setD({ convictionThreshold: v })}
                    hint="founders scoring above this get fully checked automatically"
                  />
                  <PreviewWeightCard className="mt-6">
                    <Gauge value={weights.founder} label="Founder axis" isDecimal />
                    <Gauge value={weights.market} label="Market axis" isDecimal />
                    <Gauge value={weights.idea} label="Idea axis" isDecimal />
                  </PreviewWeightCard>
                </div>
              </div>
            </StepShell>
          )}

          {STEPS[step].id === "founder" && (
            <StepShell
              n={STEPS[step].n}
              total={STEPS.length}
              title="What does a fundable founder look like to you?"
              sub="Archetypes bias sourcing. Radar will surface founders matching this pattern before they enter public fundraising."
            >
              <div className="grid gap-y-10 gap-x-12 md:grid-cols-2">
                {/* Left Column */}
                <div className="space-y-8">
                  <ChipGroup label="Archetypes" options={ARCHETYPE_OPTIONS} selected={draft.archetypes} onToggle={(v) => toggle("archetypes", v)} hint="optional, but sharper lens = sharper radar" />
                  <div className="space-y-5">
                    {(
                      [
                        ["technicalDepth", "Technical depth", "can they build the hard thing"],
                        ["distributionInstinct", "Distribution instinct", "can they get it into hands"],
                        ["storytelling", "Storytelling", "can they make the world care"],
                      ] as const
                    ).map(([k, label, sub]) => (
                      <div key={k}>
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="block font-sans text-[12px] font-bold text-[#000000]">{label}</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={draft.traits[k]}
                          onChange={(e) => setD({ traits: { ...draft.traits, [k]: Number(e.target.value) } })}
                          className="w-full h-1 bg-[#F0F0F0] rounded-lg appearance-none cursor-pointer accent-[#0045FF] slider-input"
                          style={{ background: `linear-gradient(to right, #0045FF ${draft.traits[k]}%, #F0F0F0 ${draft.traits[k]}%)` }}
                        />
                        <div className="flex justify-between text-[11px] text-[#6E6E6E] mt-1 font-sans">
                          <span>0%</span>
                          <span className="text-[#0045FF] font-semibold">{draft.traits[k]}%</span>
                          <span>100%</span>
                        </div>
                        <p className="text-[11px] text-[#6E6E6E] mt-0.5">{sub}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Column */}
                <div>
                  <PreviewWeightCard>
                    <Gauge value={draft.traits.technicalDepth} label="Technical depth" />
                    <Gauge value={draft.traits.distributionInstinct} label="Distribution instinct" />
                    <Gauge value={draft.traits.storytelling} label="Storytelling" />
                  </PreviewWeightCard>
                </div>
              </div>
            </StepShell>
          )}

          {STEPS[step].id === "signals" && (
            <StepShell
              n={STEPS[step].n}
              total={STEPS.length}
              title="Choose your radar antennae."
              sub="Each source has its own trust score. Enable only what matches your conviction style. More sources ≠ better."
            >
              <div className="grid gap-y-10 gap-x-12 md:grid-cols-2">
                {/* Left Column - All Sources as Chips */}
                <div className="space-y-6">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="block font-sans text-[12px] font-bold text-[#000000]">Antenna Sources</span>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {SOURCE_OPTIONS.map((s) => {
                      const on = draft.enabledSources.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggle("enabledSources", s.id)}
                          className={`rounded-full px-5 py-3.5 text-[13px] font-sans font-semibold transition-all flex items-center gap-2.5 ${
                            on ? "bg-[#0045FF] text-white" : "bg-[#F8F8F8] text-[#000000] hover:bg-[#eee]"
                          }`}
                        >
                          {getSourceIcon(s.id, on ? "#FFF" : "#000")}
                          <span>{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right Column - Active Sources Card */}
                <div>
                  <div className="bg-[#F8F8F8] rounded-3xl p-6 flex flex-col gap-4">
                    <span className="block font-sans text-[12px] font-bold text-[#000000]">Active Antennae</span>
                    <div className="space-y-3">
                      {SOURCE_OPTIONS.filter((s) => draft.enabledSources.includes(s.id)).map((s) => (
                        <div
                          key={s.id}
                          className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-[0_2px_8px_rgba(0,0,0,0.02)] border border-[#F0F0F0]/50"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F8F8F8] text-[#0045FF]">
                              {getSourceIcon(s.id, "#0045FF")}
                            </span>
                            <div>
                              <div className="text-[14px] font-bold text-[#000000]">{s.label}</div>
                              <div className="text-[11px] text-[#6E6E6E] mt-0.5">{s.est}</div>
                            </div>
                          </div>
                          <span className="bg-[#E6EEFF] text-[#0045FF] rounded-full px-4 py-1 text-[11px] font-bold uppercase tracking-wider">
                            {s.trust}
                          </span>
                        </div>
                      ))}
                      {draft.enabledSources.length === 0 && (
                        <div className="text-center py-8 text-[13px] text-[#6E6E6E] font-sans">
                          No active antennae selected.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </StepShell>
          )}

          {STEPS[step].id === "account" && (
            <StepShell
              n={STEPS[step].n}
              total={STEPS.length}
              title="Secure your account."
              sub="Your credentials are never stored in plain text. The session is cryptographically signed and expires automatically."
            >
              <div className="grid gap-8 md:grid-cols-2">
                <Field label="Work Email" hint="Prefilled from Step 1">
                  <input
                    value={account.email}
                    onChange={(e) => setAccount({ ...account, email: e.target.value })}
                    className={inputCls}
                    placeholder="lena@fund.group"
                    type="email"
                    autoComplete="email"
                  />
                </Field>
                <div />
                <Field label="Password" hint="8+ characters">
                  <div className="relative">
                    <input
                      value={account.password}
                      onChange={(e) => setAccount({ ...account, password: e.target.value })}
                      className={`${inputCls} pr-14`}
                      type={showPw ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Enter password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 font-sans text-[10px] font-bold uppercase text-[#6E6E6E] hover:text-[#000000]"
                    >
                      {showPw ? "hide" : "show"}
                    </button>
                  </div>
                </Field>
                <Field label="Confirm Password">
                  <input
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputCls}
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Confirm password"
                  />
                </Field>
              </div>
            </StepShell>
          )}

          {STEPS[step].id === "launch" && (
            <div className="font-sans">
              {/* Thesis compiled top card */}
              <div className="bg-gradient-to-r from-[#0045FF] to-[#001D80] rounded-3xl p-8 flex flex-col md:flex-row justify-between items-center gap-6 shadow-md mb-8 text-left">
                <div>
                  <h1 className="text-[26px] font-semibold leading-tight text-white tracking-tight">
                    Thesis compiled. Radar armed.
                  </h1>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/80 max-w-xl">
                    Review the summary. Continue to enter your command center the first pipeline is already ranked.
                  </p>
                </div>
                <button
                  onClick={launch}
                  disabled={!canContinue || launching}
                  className="relative inline-flex items-center gap-6 rounded-full bg-white pl-8 pr-2 py-2 font-sans text-[14px] font-semibold text-[#000000] shadow-md transition-all hover:bg-gray-50 disabled:opacity-40 shrink-0"
                >
                  <span>{launching ? (joinMode ? "Entering dashboard..." : "Launching...") : (joinMode ? "Complete & enter dashboard" : "Continue")}</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0045FF] text-white">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </span>
                </button>
              </div>

              {/* Review summary cards list */}
              <div className="divide-y divide-line rounded-2xl overflow-hidden border border-line bg-white shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                <ReviewRow
                  label="GP"
                  value={`${account.name || "—"} · ${identity.role}`}
                  onEdit={() => go(STEPS.findIndex(s => s.id === "you"))}
                />
                <ReviewRow
                  label="Fund"
                  value={`${identity.fundName || "unnamed"} · ${identity.fundSize || "—"}`}
                  onEdit={() => go(STEPS.findIndex(s => s.id === "fund"))}
                />
                <ReviewRow
                  label="Check / Stage"
                  value={`$${fmtK(draft.checkSizeMinUsd)}–$${fmtK(draft.checkSizeMaxUsd)} · ${draft.stages.join(", ")}`}
                  onEdit={() => go(STEPS.findIndex(s => s.id === "fund"))}
                />
                <ReviewRow
                  label="Geographies"
                  value={draft.geographies.join(" · ") || "—"}
                  onEdit={() => go(STEPS.findIndex(s => s.id === "fund"))}
                />
                <ReviewRow
                  label="Sectors"
                  value={draft.sectors.join(" · ") || "—"}
                  onEdit={() => go(STEPS.findIndex(s => s.id === "lens"))}
                />
                <ReviewRow
                  label="Archetypes"
                  value={draft.archetypes.join(" · ") || "none set"}
                  onEdit={() => go(STEPS.findIndex(s => s.id === "founder"))}
                />
                <ReviewRow
                  label="Signals"
                  value={`${draft.enabledSources.length} of 8 sources enabled`}
                  onEdit={() => go(STEPS.findIndex(s => s.id === "signals"))}
                />
                <ReviewRow
                  label="Non-negotiables"
                  value={draft.notes || "none set"}
                  onEdit={() => go(STEPS.findIndex(s => s.id === "lens"))}
                />
              </div>

              {/* Confirmed check and error outputs */}
              <div className="mt-6 space-y-4">
                <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-line bg-[#F8F8F8] px-5 py-4">
                  <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 accent-[#0045FF]" />
                  <span className="text-[13px] leading-snug text-[#6E6E6E]">
                    I understand the system <strong className="text-[#000000]">finds, checks and drafts</strong> on its own — but{" "}
                    <strong className="text-[#000000]">never invests a dollar without my confirmation</strong>.
                  </span>
                </label>

                {err ? (
                  <p className="border border-bad/40 bg-badwash px-3 py-2 text-[12px] text-bad rounded-lg">
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

                {/* Back button link for the summary step */}
                <div className="pt-4 flex justify-start">
                  <button
                    type="button"
                    onClick={() => go(step - 1)}
                    className="rounded-full border border-[#BBBBBB] bg-transparent px-7 py-3.5 font-sans text-[14px] font-semibold text-[#6E6E6E] hover:text-[#000000] hover:border-[#6E6E6E] transition-all"
                  >
                    ← Back
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer controls */}
          {(step < STEPS.length - 1 || joinMode) ? (
            <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-paper py-5 shadow-[0_-4px_24px_rgba(0,0,0,0.04)]">
              <div className="mx-auto max-w-[960px] px-6 flex items-center justify-between gap-3">
                <button
                  onClick={() => go(step - 1)}
                  disabled={step === 0}
                  className="rounded-full border border-[#BBBBBB] bg-transparent px-7 py-3.5 font-sans text-[14px] font-semibold text-[#6E6E6E] hover:text-[#000000] hover:border-[#6E6E6E] transition-all disabled:opacity-40"
                >
                  ← Back
                </button>
                <span className="hidden font-sans text-[11px] text-[#6E6E6E] sm:inline">
                  {currentIssue && step < STEPS.length - 1 ? currentIssue : "autosaved locally"}
                </span>
                <button
                  onClick={() => go(step + 1)}
                  disabled={!canContinue}
                  className="relative inline-flex items-center gap-6 rounded-full bg-gradient-to-r from-[#0045FF] to-[#001D80] pl-8 pr-2 py-2 font-sans text-[14px] font-semibold text-white shadow-md transition-all hover:brightness-110 disabled:opacity-40"
                >
                  <span>Continue</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#0045FF]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ live spec panel (kept for compile references) ----------------------------- */
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
  return null;
}

/* --------------------------------- helpers --------------------------------- */
function fmtK(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` : `${Math.round(n / 1000)}K`;
}

function formatTitle(text: string) {
  const words = text.split(" ");
  if (words.length <= 1) return text;
  const mid = Math.ceil(words.length / 2);
  return (
    <>
      {words.slice(0, mid).join(" ")}
      <br />
      {words.slice(mid).join(" ")}
    </>
  );
}

function StepShell({ n, total = 6, title, sub, children }: { n: string; total?: number; title: string; sub: string; children: React.ReactNode }) {
  const stepNum = parseInt(n, 10);
  return (
    <section className="font-sans">
      <div className="text-[14px] font-bold text-[#0045FF]">Step {stepNum} / {total}</div>
      <h1 className="mt-2 text-[38px] font-semibold leading-tight text-[#000000] tracking-tight max-w-[500px]">
        {formatTitle(title)}
      </h1>
      <p className="mt-3 text-[14px] leading-relaxed text-[#6E6E6E]">{sub}</p>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="block font-sans text-[12px] font-bold text-[#000000]">{label}</label>
        {hint ? <span className="text-[11px] text-[#6E6E6E] font-sans">{hint}</span> : null}
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
        <span className="block font-sans text-[12px] font-bold text-[#000000] mb-1.5">{label}</span>
        {hint ? <span className="text-[11px] text-[#6E6E6E] font-sans">{hint}</span> : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
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
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="block font-sans text-[12px] font-bold text-[#000000]">{label}</span>
      </div>
      <div className="relative mt-2">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1 bg-[#F0F0F0] rounded-lg appearance-none cursor-pointer accent-[#0045FF] slider-input"
          style={{ background: `linear-gradient(to right, #0045FF ${value}%, #F0F0F0 ${value}%)` }}
        />
        <div className="flex justify-between text-[11px] text-[#6E6E6E] mt-1.5 font-sans">
          <span>{left}</span>
          <span className="text-[#0045FF] font-semibold">{value}%</span>
          <span>{right}</span>
        </div>
      </div>
      {hint ? <p className="mt-1 text-[11px] text-[#6E6E6E] font-sans">{hint}</p> : null}
    </div>
  );
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 px-6 py-4.5 bg-white hover:bg-slate-50 transition-colors">
      <div className="min-w-0">
        <div className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#6E6E6E]">{label}</div>
        <div className="mt-0.5 text-[14px] leading-snug text-[#000000] font-medium">{value}</div>
      </div>
      <button onClick={onEdit} className="shrink-0 font-sans text-[11px] font-bold uppercase tracking-wide text-[#0045FF] hover:underline pt-0.5">
        edit
      </button>
    </div>
  );
}

const selectCls =
  "w-full appearance-none rounded-full border-0 bg-[#F8F8F8] px-6 py-4 text-[14px] text-[#000000] outline-none transition-colors focus:bg-[#f0f0f0] pr-10 cursor-pointer";

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string | number;
  onChange: (v: string) => void;
  options: { label: string; value: string | number }[];
}) {
  return (
    <div className="relative w-full">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectCls}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 text-[#6E6E6E]">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 15l-6-6-6 6"/>
        </svg>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>
    </div>
  );
}

function Gauge({ value, label, isDecimal = false }: { value: number; label: string; isDecimal?: boolean }) {
  const percentage = isDecimal ? value : value / 100;
  const radius = 30;
  const strokeWidth = 3;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - percentage * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-12 flex items-end justify-center">
        <svg className="w-20 h-10 overflow-visible" viewBox="0 0 80 40">
          <path
            d="M 10 40 A 30 30 0 0 1 70 40"
            fill="none"
            stroke="#EBEBEB"
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={0}
          />
          <path
            d="M 10 40 A 30 30 0 0 1 70 40"
            fill="none"
            stroke="#0045FF"
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <span className="absolute bottom-0 text-[15px] font-bold text-[#000] font-sans">
          {isDecimal ? value.toFixed(2) : Math.round(value)}
        </span>
      </div>
      <span className="text-[11px] text-[#6E6E6E] mt-2 font-sans font-medium text-center leading-tight">{label}</span>
    </div>
  );
}

function PreviewWeightCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#F8F8F8] rounded-3xl p-6 flex flex-col gap-4 ${className}`}>
      <span className="block font-sans text-[12px] font-bold text-[#000000]">Preview Weight</span>
      <div className="flex-1 flex justify-around items-center gap-2">
        {children}
      </div>
    </div>
  );
}

function getSourceIcon(id: string, color = "currentColor") {
  switch (id) {
    case "github":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
        </svg>
      );
    case "producthunt":
      return (
        <span className="font-sans text-[9px] font-extrabold w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center leading-none select-none">P</span>
      );
    case "substack":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill={color}>
          <path d="M24 0H0v3.74h24V0zm0 6H0v18l12-6 12 6V6z"/>
        </svg>
      );
    case "yc":
      return (
        <span className="font-sans text-[9px] font-extrabold w-3.5 h-3.5 bg-[#FF6600] text-white rounded flex items-center justify-center leading-none select-none">Y</span>
      );
    case "hn":
      return (
        <span className="font-sans text-[9px] font-extrabold w-3.5 h-3.5 bg-[#FF6600] text-white rounded flex items-center justify-center leading-none select-none">Y</span>
      );
    case "patents":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      );
    case "twitter":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/>
        </svg>
      );
    case "podcasts":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
        </svg>
      );
    case "conferences":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
        </svg>
      );
    case "arxiv":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      );
    case "linkedin":
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/>
          <circle cx="4" cy="4" r="2"/>
        </svg>
      );
    default:
      return null;
  }
}

function ReviewCapsule({ label, value, onEdit }: { label: string; value: string; onEdit?: () => void }) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <span className="block font-sans text-[12px] font-bold text-[#6E6E6E]">{label}</span>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-[11px] font-semibold text-[#0045FF] hover:underline transition-all"
          >
            edit
          </button>
        )}
      </div>
      <div className="w-full rounded-full bg-white px-6 py-4 text-[14px] text-[#000000] font-medium min-h-[52px] flex items-center shadow-[0_2px_8px_rgba(0,0,0,0.02)] border border-[#F0F0F0]/60">
        <span className="truncate" title={value}>{value}</span>
      </div>
    </div>
  );
}
