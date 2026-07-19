"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { inputCls, labelCls } from "../_components/ui";

function ApplyPageContent() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref") || "";

  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [pitchText, setPitchText] = useState("");
  const [interviewText, setInterviewText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [github, setGithub] = useState("");
  const [twitter, setTwitter] = useState("");
  const [linkedin, setLinkedin] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [decisionBy, setDecisionBy] = useState("");
  const [publicRef, setPublicRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const HUD_STEPS = [
    "Uploading and reading pitch deck contents…",
    "Parsing metadata and structuring core claims…",
    "Cross-referencing signals and founder footprints…",
    "Evaluating Founder, Market, and Idea axes…",
    "Finalizing recommendation for the 24-hour queue…",
  ];

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f && (f.type.includes("pdf") || f.type.startsWith("image/"))) setFile(f);
    else if (f) alert("Please drop a valid PDF or image file.");
  }
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) return setError("Company name is required.");
    if (!email.trim()) return setError("Contact email is required.");
    if (!file && !pitchText.trim()) return setError("Upload a pitch deck or write a brief text pitch.");

    setLoading(true);
    setError(null);
    let step = 0;
    const interval = setInterval(() => {
      if (step < HUD_STEPS.length - 1) setLoadingStep(++step);
    }, 1400);

    try {
      const fd = new FormData();
      fd.append("companyName", companyName);
      fd.append("email", email);
      fd.append("text", pitchText);
      if (file) fd.append("deck", file);
      if (fullName) fd.append("founderName", fullName);
      if (github) fd.append("github", github);
      if (twitter) fd.append("twitter", twitter);
      if (linkedin) fd.append("linkedin", linkedin);
      if (interviewText.trim()) fd.append("interview", interviewText.trim());

      const targetUrl = ref ? `/api/apply?ref=${encodeURIComponent(ref)}` : "/api/apply";
      const res = await fetch(targetUrl, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to submit application.");
      clearInterval(interval);
      setPublicRef(data?.data?.publicRef ?? null);
      setDecisionBy(new Date(Date.now() + 24 * 3600 * 1000).toLocaleDateString());
      setSubmitted(true);
    } catch (err) {
      clearInterval(interval);
      setError((err as Error).message || "An unexpected error occurred.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8fb] text-ink">
      {/* Header · matches the workspace brand */}
      <header className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="ODIN Logo" className="w-8 h-8 rounded-full" />
          <span className="text-[17px] font-extrabold tracking-tight">ODIN</span>
        </Link>
        <span className="rounded-full bg-white px-3.5 py-2 text-[11px] font-semibold text-muted u-card">Inbound Portal</span>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-8">
        <div className="w-full max-w-[600px] rounded-[28px] border border-[#eceef3] bg-white p-8 u-soft md:p-10">
          {!submitted ? (
            <>
              <div className="mb-7 text-center">
                <span className="inline-block rounded-full bg-[#EBF0FF] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#0045FF]">
                  Zero-friction inbound gate
                </span>
                {ref ? (
                  <div className="mt-2 inline-block rounded-full bg-okwash px-3 py-1 text-[11px] font-semibold text-ok">✓ Sourced referral link active</div>
                ) : null}
                <h1 className="mt-3 text-[26px] font-extrabold tracking-tight">Apply for funding</h1>
                <p className="mx-auto mt-1.5 max-w-md text-[13px] text-muted">
                  Submit your company details. Our autonomous validator screens and audits your pitch against the thesis within 24 hours.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {error ? (
                  <div className="rounded-xl bg-badwash px-3 py-2.5 text-center text-[12.5px] font-medium text-bad">{error}</div>
                ) : null}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Company name *</label>
                    <input className={inputCls} required value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Cursor" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Contact email *</label>
                    <input className={inputCls} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="founder@company.com" />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Founder name</label>
                  <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Lena Chen" />
                </div>

                <div className="border-t border-[#eceef3] pt-4">
                  <label className={`${labelCls} mb-2.5 block`}>Public footprint handles <span className="normal-case text-faint">(for enrichment)</span></label>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="flex flex-col gap-1"><span className="text-[10px] text-faint">GitHub</span><input className={inputCls} value={github} onChange={(e) => setGithub(e.target.value)} placeholder="github_login" /></div>
                    <div className="flex flex-col gap-1"><span className="text-[10px] text-faint">Twitter / X</span><input className={inputCls} value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="handle" /></div>
                    <div className="flex flex-col gap-1"><span className="text-[10px] text-faint">LinkedIn URL</span><input className={inputCls} value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="in/username" /></div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Pitch deck PDF / image *</label>
                  <div
                    onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
                    onClick={() => document.getElementById("deck-file-apply")?.click()}
                    className={`cursor-pointer rounded-2xl border border-dashed p-6 text-center transition-colors ${dragActive ? "border-[#0045FF] bg-[#EBF0FF]" : "border-[#e6e8ee] bg-[#F8F8F8] hover:border-[#0045FF]/50"}`}
                  >
                    <input type="file" id="deck-file-apply" accept=".pdf,image/*" onChange={handleFileChange} className="hidden" />
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0045FF" strokeWidth="1.6" className="mx-auto mb-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
                    {file ? (
                      <div><p className="text-[13px] font-semibold text-ink">{file.name}</p><p className="mt-0.5 text-[11px] text-faint">{(file.size / 1024 / 1024).toFixed(2)} MB · ready to audit</p></div>
                    ) : (
                      <p className="text-[12.5px] text-muted">Drag and drop your pitch deck here, or <span className="font-semibold text-[#0045FF]">browse</span></p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Or paste pitch details</label>
                  <textarea className={`${inputCls} resize-none`} rows={4} value={pitchText} onChange={(e) => setPitchText(e.target.value)} placeholder="One-liner, sector, stage, problem, product details, or co-founder background…" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Interview / call notes <span className="normal-case text-faint">(optional)</span></label>
                  <textarea className={`${inputCls} resize-none`} rows={3} value={interviewText} onChange={(e) => setInterviewText(e.target.value)} placeholder="Paste notes from a call or interview · they become a separate evidence source the validator cross-checks against your deck." />
                </div>

                <button type="submit" className="u-btn-primary mt-1 w-full justify-center py-3.5 text-[14px]">Submit application</button>
              </form>
            </>
          ) : (
            <div className="py-6 text-center">
              <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full bg-okwash text-ok">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h1 className="text-[22px] font-extrabold tracking-tight">Application received</h1>
              <p className="mx-auto mt-3 max-w-md text-[13.5px] text-muted">
                Your pitch is in the assessment queue. The validator agent is auditing the claims against our thesis and your public footprint. A human investor makes the final call within 24 hours.
              </p>
              <div className="mt-5 inline-block rounded-xl border border-[#eceef3] bg-[#fafbfd] px-4 py-2.5 text-[12px] font-semibold text-[#0045FF]">
                Expected decision by {decisionBy}
              </div>
              <div className="mt-7 flex justify-center gap-3">
                {publicRef ? (
                  <Link href={`/apply/status?ref=${publicRef}`} className="u-btn-primary px-5 py-2.5 text-[13px]">Track your application →</Link>
                ) : null}
                <Link href="/" className="rounded-full border border-[#e6e8ee] bg-white px-5 py-2.5 text-[13px] font-semibold text-ink hover:border-[#0045FF] hover:text-[#0045FF]">Return home</Link>
              </div>
            </div>
          )}
        </div>
      </main>

      {loading && !submitted ? (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white/85 backdrop-blur-sm">
          <div className="flex max-w-[400px] flex-col items-center p-6 text-center">
            <div className="relative mb-8 h-16 w-16">
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-[#0045FF] border-t-transparent" />
            </div>
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-ink">ODIN screening</h3>
            <p className="mt-2 h-10 text-[12.5px] text-muted">{HUD_STEPS[loadingStep]}</p>
            <div className="mt-5 h-1.5 w-48 overflow-hidden rounded-full bg-[#eceef3]">
              <div className="h-full rounded-full bg-[#0045FF] transition-all duration-1000" style={{ width: `${((loadingStep + 1) / HUD_STEPS.length) * 100}%` }} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ApplyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#f7f8fb] text-[13px] text-muted">Loading apply form…</div>}>
      <ApplyPageContent />
    </Suspense>
  );
}
