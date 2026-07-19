"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import DarkVeilClient from "../_components/DarkVeilClient";

function ApplyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref") || "";

  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [pitchText, setPitchText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  
  // Handles
  const [github, setGithub] = useState("");
  const [twitter, setTwitter] = useState("");
  const [linkedin, setLinkedin] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const HUD_STEPS = [
    "Uploading and reading pitch deck contents...",
    "Parsing metadata and structuring core claims...",
    "Cross-referencing signals and founder footprints...",
    "Evaluating Founder, Market, and Idea axes...",
    "Finalizing recommendation for the 24-hour queue..."
  ];

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.includes("pdf") || droppedFile.type.startsWith("image/")) {
        setFile(droppedFile);
      } else {
        alert("Please drop a valid PDF or Image file.");
      }
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) {
      setError("Company name is required.");
      return;
    }
    if (!email.trim()) {
      setError("Contact email is required.");
      return;
    }
    if (!file && !pitchText.trim()) {
      setError("Please upload a pitch deck file or write a brief text pitch.");
      return;
    }

    setLoading(true);
    setError(null);

    // Simulate HUD loader progression
    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < HUD_STEPS.length - 1) {
        currentStep++;
        setLoadingStep(currentStep);
      }
    }, 1400);

    try {
      const formData = new FormData();
      formData.append("companyName", companyName);
      formData.append("text", pitchText);
      if (file) {
        formData.append("deck", file);
      }
      
      // We send structural founder metadata for automatic enrichment if parsed
      // The API endpoint accepts standard extraction mapping
      if (fullName) formData.append("founderName", fullName);
      if (github) formData.append("github", github);
      if (twitter) formData.append("twitter", twitter);
      if (linkedin) formData.append("linkedin", linkedin);

      const targetUrl = ref ? `/api/apply?ref=${encodeURIComponent(ref)}` : "/api/apply";
      const res = await fetch(targetUrl, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to submit application.");
      }

      clearInterval(interval);
      setSubmitted(true);
    } catch (err) {
      clearInterval(interval);
      setError((err as Error).message || "An unexpected error occurred.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col relative overflow-hidden" style={{ background: "#07090E" }}>
      {/* DarkVeil background */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.35, mixBlendMode: "screen" }}>
        <DarkVeilClient hueShift={220} noiseIntensity={0.04} speed={0.4} warpAmount={0.3} />
      </div>

      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-6 h-20 flex items-center justify-between relative z-10 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2.5 text-white hover:opacity-90 transition-opacity">
          <span className="w-8 h-8 flex items-center justify-center border border-white/30 rounded-lg">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
              <path d="M9 1 3 9h4l-1 6 6-8H8l1-6z" />
            </svg>
          </span>
          <span className="font-mono text-[13px] font-bold tracking-[0.12em]">VC.BRAIN</span>
        </Link>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">
          Inbound Portal
        </span>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-[560px] bg-card border border-line p-8 md:p-10 shadow-2xl rounded-2xl" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)" }}>
          {!submitted ? (
            <>
              <div className="text-center mb-8">
                <span className="inline-block bg-accent/10 border border-accent/30 text-accent font-mono text-[10px] uppercase tracking-[0.1em] px-3 py-1 rounded-full">
                  Zero-Friction Inbound Gate
                </span>
                {ref && (
                  <div className="mt-2.5 font-mono text-[11px] text-[#A3E635] bg-[#A3E635]/5 border border-[#A3E635]/20 px-3 py-1 rounded inline-block">
                    ✓ Sourced Referral Link Active
                  </div>
                )}
                <h1 className="text-2xl font-bold mt-3 text-white">Apply for Funding</h1>
                <p className="text-[13px] text-muted mt-1.5 leading-relaxed">
                  Submit your company details. Our autonomous validator screens and audits your pitch against the thesis within 24 hours.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5 text-white">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-[12.5px] text-center">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[10.5px] text-muted uppercase tracking-wider">Company Name *</label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Cursor"
                      className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-[13.5px] focus:border-accent focus:outline-none transition-colors"
                      style={{ color: "#fff" }}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[10.5px] text-muted uppercase tracking-wider">Contact Email *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="founder@company.com"
                      className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-[13.5px] focus:border-accent focus:outline-none transition-colors"
                      style={{ color: "#fff" }}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10.5px] text-muted uppercase tracking-wider">Founder Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Lena Chen"
                    className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-[13.5px] focus:border-accent focus:outline-none transition-colors"
                    style={{ color: "#fff" }}
                  />
                </div>

                {/* Handles */}
                <div className="border-t border-white/5 pt-4">
                  <label className="font-mono text-[10.5px] text-muted uppercase tracking-wider mb-2.5 block">
                    Public Footprint Handles (for enrichment)
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-faint">GitHub</span>
                      <input
                        type="text"
                        value={github}
                        onChange={(e) => setGithub(e.target.value)}
                        placeholder="github_login"
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[12.5px] focus:border-accent focus:outline-none"
                        style={{ color: "#fff" }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-faint">Twitter / X</span>
                      <input
                        type="text"
                        value={twitter}
                        onChange={(e) => setTwitter(e.target.value)}
                        placeholder="handle"
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[12.5px] focus:border-accent focus:outline-none"
                        style={{ color: "#fff" }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-faint">LinkedIn URL</span>
                      <input
                        type="text"
                        value={linkedin}
                        onChange={(e) => setLinkedin(e.target.value)}
                        placeholder="in/username"
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[12.5px] focus:border-accent focus:outline-none"
                        style={{ color: "#fff" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Pitch Deck File */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10.5px] text-muted uppercase tracking-wider">Pitch Deck PDF / Image *</label>
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById("deck-file-apply")?.click()}
                    className={`border border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                      dragActive ? "border-accent bg-accent/5" : "border-white/10 hover:border-white/20 bg-white/[0.01]"
                    }`}
                  >
                    <input
                      type="file"
                      id="deck-file-apply"
                      accept=".pdf,image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" className="mx-auto mb-2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                    </svg>
                    {file ? (
                      <div>
                        <p className="text-[13px] font-semibold text-white">{file.name}</p>
                        <p className="text-[11px] text-faint mt-0.5">
                          {(file.size / 1024 / 1024).toFixed(2)} MB · Ready to audit
                        </p>
                      </div>
                    ) : (
                      <p className="text-[12.5px] text-muted">
                        Drag and drop your pitch deck file here, or <span className="text-accent font-semibold">browse</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10.5px] text-muted uppercase tracking-wider">Or paste pitch details</label>
                  <textarea
                    value={pitchText}
                    onChange={(e) => setPitchText(e.target.value)}
                    placeholder="One-liner, sector, stage, problem, product details, or co-founder background..."
                    rows={4}
                    className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-[13.5px] focus:border-accent focus:outline-none resize-none transition-colors"
                    style={{ color: "#fff" }}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-accent hover:opacity-95 text-white font-semibold py-3 rounded-lg text-[14px] mt-2 shadow-lg transition-all focus:outline-none"
                  style={{ background: "linear-gradient(90deg, #0045FF 0%, #002999 100%)", boxShadow: "0 4px 15px rgba(0,69,255,0.3)" }}
                >
                  Submit Application
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-6">
              <div className="inline-flex w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 items-center justify-center mb-6">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-white">Application Received</h1>
              <p className="text-[13.5px] text-muted mt-3.5 leading-relaxed">
                Your pitch deck has been successfully loaded into the assessment queue. The Validator Agent is auditing the claims against our thesis and public footprints.
              </p>
              <div className="mt-5 p-3.5 border border-white/5 rounded-lg bg-white/[0.01] inline-block">
                <span className="font-mono text-[11px] text-accent">
                  Expected Decision By: {new Date(Date.now() + 24 * 3600 * 1000).toLocaleDateString()} local
                </span>
              </div>
              <div className="mt-8 flex justify-center">
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

      {/* Holographic Loader Overlay */}
      {loading && !submitted && (
        <div 
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(7, 9, 14, 0.96)",
            backdropFilter: "blur(6px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div className="flex flex-col items-center max-w-[400px] text-center p-6">
            <div className="relative w-16 h-16 mb-8">
              <div 
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: "4px solid #0045FF",
                  borderTopColor: "transparent",
                  animation: "spin 1s linear infinite"
                }}
              />
              <div 
                style={{
                  position: "absolute",
                  inset: "-8px",
                  borderRadius: "50%",
                  border: "1px solid rgba(0, 194, 255, 0.3)",
                  animation: "ping 1s cubic-bezier(0, 0, 0.2, 1) infinite"
                }}
              />
            </div>
            <h3 className="text-[14px] font-bold text-white tracking-[0.08em] uppercase">VC Brain Screening</h3>
            <p className="text-[12.5px] font-mono text-muted mt-2 h-10">
              {HUD_STEPS[loadingStep]}
            </p>
            <div className="w-48 h-1.5 bg-white/5 rounded-full overflow-hidden mt-6">
              <div 
                className="h-full bg-accent transition-all duration-1000"
                style={{
                  background: "linear-gradient(90deg, #0045FF, #00C2FF)",
                  width: `${((loadingStep + 1) / HUD_STEPS.length) * 100}%`
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* CSS Animation Keyframes Inject */}
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default function ApplyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-paper text-ink flex items-center justify-center font-mono text-[13px] text-muted" style={{ background: "#07090E" }}>
        Loading apply form...
      </div>
    }>
      <ApplyPageContent />
    </Suspense>
  );
}
