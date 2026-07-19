"use client";
import { useState } from "react";
import { api } from "./api";
import { Eyebrow, Modal, inputCls, labelCls } from "./ui";

/** Signal-type header per channel. */
export const CHANNEL_SIGNAL: Record<string, string> = {
  github: "GitHub velocity",
  hackernews: "Show HN launch",
  arxiv: "arXiv paper",
  producthunt: "Product Hunt launch",
  hackathons: "Hackathon win",
  patents: "Patent filing",
  accelerators: "Accelerator cohort",
  web: "Web signal",
  application: "Inbound application",
};

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Inline client-side filter over an already-loaded list. Matches the topbar search look. */
export function ListSearch({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 rounded-full bg-white px-4 py-2.5 u-card ${className ?? "max-w-sm"}`}>
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="shrink-0 text-faint" aria-hidden>
        <circle cx="9" cy="9" r="6" />
        <path d="m17 17-3.2-3.2" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search this list…"}
        className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
        aria-label={placeholder ?? "Search this list"}
      />
      {value ? (
        <button type="button" onClick={() => onChange("")} className="shrink-0 text-[13px] text-faint hover:text-ink" aria-label="Clear search">
          ✕
        </button>
      ) : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  sub,
  right,
}: {
  eyebrow?: string;
  title: string;
  sub?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h1 className="mt-1.5 text-[26px] font-extrabold leading-tight tracking-tight text-ink">{title}</h1>
        {sub ? <p className="mt-1.5 max-w-2xl text-[13.5px] text-muted">{sub}</p> : null}
      </div>
      {right ? <div className="flex shrink-0 flex-col items-end gap-2">{right}</div> : null}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  tone = "accent",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "accent" | "ink" | "ok";
  type?: "button" | "submit" | "reset";
}) {
  const cls =
    tone === "ok"
      ? "bg-ok text-white hover:opacity-90 shadow-[0_6px_16px_rgba(18,161,80,0.22)]"
      : tone === "ink"
        ? "bg-ink text-white hover:opacity-90"
        : "u-btn-primary";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`u-btn px-5 py-2.5 text-[13px] ${cls}`}>
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className="u-btn u-btn-ghost px-5 py-2.5 text-[13px]">
      {children}
    </button>
  );
}

/** Inbound application — deck + company name is the minimum bar. */
export function ApplyModal({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const [companyName, setCompanyName] = useState("");
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!companyName && !text && !file) {
      setErr("Add a company name and a deck (file or pasted text).");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.set("companyName", companyName);
      if (text) fd.set("text", text);
      if (file) fd.set("deck", file);
      if (email) fd.set("email", email);
      const r = await api<{ opportunityId: string }>("/api/apply", { method: "POST", body: fd });
      onDone(r.opportunityId);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="New application" onClose={onClose}>
      <p className="-mt-2 mb-4 text-[12.5px] text-muted">Deck + company name is all we need to start.</p>
      <label className={labelCls}>Company name</label>
      <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} placeholder="Acme AI" />
      
      <label className={`mt-4 ${labelCls}`}>Founder Email (optional)</label>
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={inputCls} placeholder="founder@acme.ai" />

      <label className={`mt-4 ${labelCls}`}>Deck (PDF or image)</label>
      <input
        type="file"
        accept=".pdf,image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="mt-1.5 w-full text-[12.5px] text-muted file:mr-3 file:rounded-full file:border-0 file:bg-brandfaint file:px-4 file:py-2 file:text-[12px] file:font-semibold file:text-brand"
      />
      <label className={`mt-4 ${labelCls}`}>…or paste deck text</label>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className={inputCls} placeholder="Problem, product, team, traction…" />
      <p className="mt-2 text-[11.5px] text-faint">That&apos;s the whole form — over-collecting works against a 24-hour decision.</p>
      {err ? <p className="mt-2 text-[12.5px] text-bad">{err}</p> : null}
      <div className="mt-5 flex justify-end gap-2.5">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={submit} disabled={loading}>
          {loading ? "Parsing…" : "Submit application"}
        </PrimaryButton>
      </div>
    </Modal>
  );
}
