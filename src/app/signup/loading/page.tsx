"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/app/_components/api";

type AuditResult = {
  id: string;
  company: string;
  founder: string;
  outcome: string;
};

// Interactive 3D Starfield Canvas Component
function StarfieldCanvas({ auditedCount, phase }: { auditedCount: number; phase: "sourcing" | "auditing" | "done" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetSpeedRef = useRef(1.5);
  const speedRef = useRef(1.5);
  const lastCountRef = useRef(auditedCount);
  
  // Track mouse coordinates for tilt parallax
  const mouseRef = useRef({ x: 0, y: 0 });
  const activeMouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Warp speed trigger on new audits
    if (auditedCount > lastCountRef.current) {
      targetSpeedRef.current = 45; // Warp burst!
      setTimeout(() => {
        targetSpeedRef.current = 0.8; // Slow auditing speed
      }, 800);
    }
    lastCountRef.current = auditedCount;
  }, [auditedCount]);

  useEffect(() => {
    if (phase === "sourcing") {
      targetSpeedRef.current = 4.0; // Sourcing speed
    } else if (phase === "auditing") {
      targetSpeedRef.current = 0.8; // Base auditing speed
    } else if (phase === "done") {
      targetSpeedRef.current = 0.15; // Slow down celebrate
    }
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      mouseRef.current.y = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Star attributes
    const numStars = 180;
    const stars: Array<{
      x: number;
      y: number;
      z: number;
      color: string;
      size: number;
    }> = [];

    const colors = ["#fcfbf7", "#f3d9cb", "#c44e1c", "#e4e0d4", "#a87614", "#2ea44f"];

    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: (Math.random() - 0.5) * 2000,
        y: (Math.random() - 0.5) * 2000,
        z: Math.random() * 2000,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 1.6 + 0.4,
      });
    }

    const render = () => {
      const currentSpeed = speedRef.current;
      const isWarping = currentSpeed > 10;
      
      // Clear with translucency to create motion trails
      ctx.fillStyle = isWarping ? "rgba(13, 15, 18, 0.12)" : "rgba(13, 15, 18, 0.22)";
      ctx.fillRect(0, 0, width, height);

      // Lerp speed & mouse parallax
      speedRef.current += (targetSpeedRef.current - speedRef.current) * 0.08;
      activeMouseRef.current.x += (mouseRef.current.x - activeMouseRef.current.x) * 0.05;
      activeMouseRef.current.y += (mouseRef.current.y - activeMouseRef.current.y) * 0.05;

      const centerX = width / 2 + activeMouseRef.current.x * 100;
      const centerY = height / 2 + activeMouseRef.current.y * 100;

      // Draw light radar scan rings during sourcing
      if (phase === "sourcing") {
        const time = Date.now() * 0.0015;
        ctx.strokeStyle = "rgba(196, 78, 28, 0.03)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, (time % 1) * Math.max(width, height) * 0.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (let i = 0; i < numStars; i++) {
        const star = stars[i];
        const prevZ = star.z;

        star.z -= speedRef.current;

        if (star.z <= 0) {
          star.z = 2000;
          star.x = (Math.random() - 0.5) * 2000;
          star.y = (Math.random() - 0.5) * 2000;
        }

        // 3D coordinates projections
        const px = (star.x / prevZ) * width + centerX;
        const py = (star.y / prevZ) * height + centerY;

        const x = (star.x / star.z) * width + centerX;
        const y = (star.y / star.z) * height + centerY;

        if (x >= 0 && x <= width && y >= 0 && y <= height) {
          if (isWarping) {
            ctx.strokeStyle = star.color;
            ctx.lineWidth = star.size * (speedRef.current / 10);
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(x, y);
            ctx.stroke();
          } else {
            ctx.fillStyle = star.color;
            const radius = star.size * (1 - star.z / 2000) * 2.2;
            ctx.beginPath();
            ctx.arc(x, y, Math.max(0.5, radius), 0, Math.PI * 2);
            ctx.fill();

            // Glow aura for accent colors
            if (radius > 1.2 && (star.color === "#c44e1c" || star.color === "#2ea44f")) {
              ctx.fillStyle = star.color === "#c44e1c" ? "rgba(196, 78, 28, 0.12)" : "rgba(46, 164, 79, 0.12)";
              ctx.beginPath();
              ctx.arc(x, y, radius * 3.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [phase]);

  return <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full pointer-events-none" />;
}

export default function SignupLoadingPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"sourcing" | "auditing" | "done">("sourcing");
  const [audited, setAudited] = useState<AuditResult[]>([]);
  const [currentChecking, setCurrentChecking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runRef = useRef(false);

  useEffect(() => {
    if (runRef.current) return;
    runRef.current = true;

    async function runOnboardingProcess() {
      try {
        // Step 1: Sourcing
        await postJson<{ autoScreened: number }>("/api/source/all");
        
        // Step 2: Auditing one by one up to 10
        setPhase("auditing");
        let count = 0;
        while (count < 10) {
          setCurrentChecking(`Auditing candidate ${count + 1}...`);
          const res = await postJson<{ processed: string | null; company?: string; founder?: string; outcome?: string }>("/api/autopilot/next");
          
          if (!res.processed) {
            break; // Queue is empty
          }

          setAudited((prev) => [
            ...prev,
            {
              id: res.processed!,
              company: res.company || "Unknown Company",
              founder: res.founder || "Unknown Founder",
              outcome: res.outcome || "Processed",
            },
          ]);
          count++;
        }
        
        setPhase("done");
        // Auto redirect after 4 seconds, or let them click the button
        setTimeout(() => {
          router.push("/dashboard");
        }, 4000);
      } catch (err) {
        console.error(err);
        setError("Onboarding sweep failed. You can skip to the dashboard.");
        setPhase("done");
      }
    }

    runOnboardingProcess();
  }, [router]);

  const progressPercent = phase === "sourcing" ? 15 : phase === "auditing" ? 15 + (audited.length * 8) : 100;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#0d0f12] text-[#f3f4f6] p-6 overflow-hidden select-none">
      {/* Dynamic Starfield Background */}
      <StarfieldCanvas auditedCount={audited.length} phase={phase} />

      {/* Styled animation overrides */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(8px); filter: blur(1.5px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        .log-item {
          animation: slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .crt-overlay {
          pointer-events: none;
          position: absolute;
          inset: 0;
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.15) 50%);
          background-size: 100% 4px;
          z-index: 10;
          border-radius: inherit;
        }
      `}</style>

      {/* Holographic Glowing Dashboard Container */}
      <div className="relative z-10 w-full max-w-2xl border border-white/10 bg-[#12161f]/85 backdrop-blur-lg p-8 rounded-xl shadow-[0_0_50px_rgba(196,78,28,0.15)] transition-all duration-300">
        <div className="crt-overlay" />
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="relative flex h-9 w-9 items-center justify-center bg-[#c44e1c] text-[#fff] rounded-full shadow-[0_0_15px_rgba(196,78,28,0.5)]">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M9 1 3 9h4l-1 6 6-8H8l1-6z" />
              </svg>
            </span>
            <div>
              <h1 className="font-mono text-lg font-bold tracking-wide text-white">VC.BRAIN</h1>
              <p className="font-mono text-[9.5px] uppercase tracking-widest text-[#8b949e]">Calibrating Memory Engine</p>
            </div>
          </div>
          
          <div className="text-right font-mono text-[10px] text-[#8b949e]">
            {phase === "sourcing" ? (
              <span className="text-[#c44e1c] animate-pulse">SOURCING ACTIVE</span>
            ) : phase === "auditing" ? (
              <span className="text-[#e4e0d4] animate-pulse">AUDITING QUEUE</span>
            ) : (
              <span className="text-[#2ea44f]">CALIBRATION COMPLETE</span>
            )}
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between font-mono text-[10px] uppercase text-[#8b949e] mb-2">
            <span>engine load & calibrate</span>
            <span className="text-[#c44e1c] font-bold">{progressPercent}%</span>
          </div>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
            <div 
              className="h-full bg-gradient-to-r from-[#c44e1c] via-[#e4e0d4] to-[#2ea44f] transition-all duration-500 ease-out shadow-[0_0_8px_#c44e1c]" 
              style={{ width: `${progressPercent}%` }} 
            />
          </div>
        </div>

        <div className="space-y-6">
          {/* Phase 1: Sourcing */}
          <div className="flex items-start gap-4">
            <div className="mt-0.5">
              {phase === "sourcing" ? (
                <div className="relative flex h-5 w-5 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c44e1c]/45 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#c44e1c]" />
                </div>
              ) : (
                <span className="flex h-5 w-5 items-center justify-center text-[#2ea44f] font-mono font-bold text-sm bg-[#2ea44f]/10 border border-[#2ea44f]/20 rounded-full">✓</span>
              )}
            </div>
            <div className="flex-1">
              <p className="font-mono text-[13px] font-semibold text-white">1. Sourcing Outbound Candidates</p>
              <p className="text-[12.5px] text-[#8b949e] mt-1 leading-relaxed">
                Scanning developer signals, HN launches, arXiv publications, and accelerator cohorts...
              </p>
            </div>
          </div>

          {/* Phase 2: Auditing */}
          {phase !== "sourcing" && (
            <div className="flex items-start gap-4 border-t border-white/5 pt-5">
              <div className="mt-0.5">
                {phase === "auditing" ? (
                  <div className="relative flex h-5 w-5 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2ea44f]/35 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#2ea44f]" />
                  </div>
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center text-[#2ea44f] font-mono font-bold text-sm bg-[#2ea44f]/10 border border-[#2ea44f]/20 rounded-full">✓</span>
                )}
              </div>
              <div className="flex-1">
                <p className="font-mono text-[13px] font-semibold text-white">2. Screening & Verification Audits (Top 10)</p>
                <p className="text-[12.5px] text-[#8b949e] mt-1 leading-relaxed">
                  Verifying founder credentials and claims deeply across GitHub, arXiv, and LinkedIn...
                </p>

                {/* Audit Results CRT Styled Log Box */}
                <div className="relative mt-4 border border-white/10 bg-[#07090d]/85 p-4 rounded-lg max-h-60 overflow-y-auto space-y-2.5 shadow-inner">
                  {audited.map((r, i) => (
                    <div 
                      key={r.id} 
                      className="log-item flex justify-between items-center py-1.5 border-b border-white/5 last:border-b-0"
                    >
                      <span className="text-[#c9d1d9] text-[11px] font-mono truncate mr-4">
                        <span className="text-[#c44e1c]/80 mr-1.5 font-bold">{(i + 1).toString().padStart(2, "0")}.</span>
                        <strong className="text-white font-medium">{r.founder}</strong>
                        <span className="text-[#8b949e] ml-2">@{r.company}</span>
                      </span>
                      <span className={`shrink-0 px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider border ${
                        r.outcome === "screened_out" 
                          ? "bg-red-500/10 text-red-400 border-red-500/20" 
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      }`}>
                        {r.outcome === "screened_out" ? "✕ Screened out" : "✓ Verified"}
                      </span>
                    </div>
                  ))}
                  
                  {phase === "auditing" && currentChecking && (
                    <div className="flex items-center justify-between py-1.5 text-[#c44e1c] font-mono text-[11px] animate-pulse">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#c44e1c] animate-ping" />
                        <span>{currentChecking}</span>
                      </div>
                      <span className="text-[10px] uppercase text-[#8b949e]">analyzing...</span>
                    </div>
                  )}
                  
                  {audited.length === 0 && !currentChecking && (
                    <p className="text-[#8b949e] italic font-mono text-[11px] text-center py-2">No candidates in queue...</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Phase 3: Launch */}
          {phase === "done" && (
            <div className="flex flex-col items-center border-t border-white/5 pt-6 text-center">
              {error ? (
                <p className="text-[12.5px] text-[#f85149] font-mono mb-4">{error}</p>
              ) : (
                <div className="mb-4">
                  <p className="text-[13px] text-[#2ea44f] font-mono font-semibold animate-bounce">
                    🚀 Memory Engine calibrated! Sourced and audited top deals.
                  </p>
                  <p className="text-[11px] text-[#8b949e] font-mono mt-1">Redirecting to Command Center automatically...</p>
                </div>
              )}
              <button
                onClick={() => router.push("/dashboard")}
                className="bg-[#c44e1c] px-6 py-2.5 font-mono text-[12px] font-bold uppercase tracking-wide text-white hover:bg-[#a93f14] transition-all rounded shadow-[0_0_15px_rgba(196,78,28,0.3)] hover:shadow-[0_0_22px_rgba(196,78,28,0.5)] active:scale-[0.98]"
              >
                ⚡ Enter Command Center
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
