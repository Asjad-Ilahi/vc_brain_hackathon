"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, postJson } from "../_components/api";
import CalibrationWizard from "../_components/CalibrationWizard";
import AuthCard from "../_components/AuthCard";
import { inputCls, labelCls } from "../_components/ui";

function AdminGateway() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRoute = searchParams.get("next") || "/dashboard";

  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [onboarded, setOnboarded] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check current auth status on mount
  useEffect(() => {
    api<{ user: { name: string; email: string } | null; onboarded: boolean }>("/api/auth/me")
      .then((r) => {
        if (r.user) {
          setUser(r.user);
          setOnboarded(r.onboarded);
          if (r.onboarded) {
            router.replace(nextRoute);
          } else {
            setChecking(false);
          }
        } else {
          setChecking(false);
        }
      })
      .catch(() => {
        setChecking(false);
      });
  }, [router, nextRoute]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await postJson<{ user: { name: string; email: string }; onboarded: boolean }>(
        "/api/auth/login",
        { email, password }
      );
      setUser(res.user);
      setOnboarded(res.onboarded);
      if (res.onboarded) {
        router.replace(nextRoute);
      } else {
        setChecking(false);
      }
    } catch (err) {
      setError((err as Error).message || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  }

  // Preset default admin credentials to make testing completely seamless
  function presetCredentials() {
    setEmail("admin@maschmeyer.vc");
    setPassword("password123");
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper font-sans text-[#000000]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#0045FF] border-t-transparent"></div>
          <p className="text-[13px] tracking-wide text-gray-500 font-mono">Synchronizing command center...</p>
        </div>
      </div>
    );
  }

  // Not logged in: show the corporate GP sign-in card with AuthCard styling
  if (!user) {
    return (
      <AuthCard
        eyebrow="Investor Gateway"
        title="Investor Command Center"
        sub="Authorized personnel only. Authenticate to synchronize workspace parameters."
        footer={
          <>
            Testing the app?{" "}
            <button
              type="button"
              onClick={presetCredentials}
              className="text-[#0045FF] hover:underline bg-transparent border-none cursor-pointer p-0 font-sans font-semibold"
            >
              Preset GP Sandbox Credentials
            </button>
          </>
        }
      >
        <form onSubmit={handleLogin} className="flex flex-col">
          <label className={labelCls}>Work Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="partner@maschmeyer.vc"
            className={inputCls}
            autoComplete="email"
          />

          <label className={`mt-4 ${labelCls}`}>Secure Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={inputCls}
            autoComplete="current-password"
          />

          {error && <p className="mt-3 text-[12px] text-bad font-mono">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-full bg-[#0045FF] py-4 text-[14px] font-semibold text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-40 cursor-pointer"
          >
            {loading ? "Authenticating..." : "Synchronize & Continue"}
          </button>
        </form>
      </AuthCard>
    );
  }

  // Logged in but not onboarded: render the Calibration Wizard to initialize thesis
  return (
    <div className="min-h-screen bg-paper">
      <CalibrationWizard mode="signup" />
    </div>
  );
}

export default function AdminGatewayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-paper font-sans text-[#000000]">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#0045FF] border-t-transparent"></div>
            <p className="text-[13px] tracking-wide text-gray-500 font-mono">Loading gateway...</p>
          </div>
        </div>
      }
    >
      <AdminGateway />
    </Suspense>
  );
}
