"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, postJson } from "../_components/api";
import AuthCard from "../_components/AuthCard";
import { inputCls, labelCls } from "../_components/ui";

/**
 * First-run bootstrap screen. If the workspace already has an operator, there is
 * nothing to set up — send them to sign in. Otherwise, create the founding admin
 * and drop straight into thesis calibration.
 */
export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api<{ needsSetup: boolean }>("/api/setup");
        if (cancelled) return;
        if (!r.needsSetup) {
          router.replace("/admin");
          return;
        }
        setChecking(false);
      } catch {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await postJson("/api/setup", { name, email, password });
      // Founding admin created + signed in → calibrate the fund thesis.
      router.replace("/onboarding");
    } catch (err) {
      setError((err as Error).message || "Setup failed.");
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper font-sans text-[#000000]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#0045FF] border-t-transparent" />
          <p className="text-[13px] tracking-wide text-gray-500 font-mono">Checking workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <AuthCard
      eyebrow="First-run setup"
      title="Create the founding admin"
      sub="This is a fresh workspace. The first account is the administrator — it provisions everyone else. There is no public sign-up."
      footer={
        <>
          Already set up?{" "}
          <a href="/admin" className="text-[#0045FF] hover:underline font-semibold">
            Sign in
          </a>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col">
        <label className={labelCls}>Full Name</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Marcel Maschmeyer"
          className={inputCls}
          autoComplete="name"
        />

        <label className={`mt-4 ${labelCls}`}>Work Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@yourfund.vc"
          className={inputCls}
          autoComplete="email"
        />

        <label className={`mt-4 ${labelCls}`}>Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className={inputCls}
          autoComplete="new-password"
        />

        {error && <p className="mt-3 text-[12px] text-bad font-mono">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-full bg-[#0045FF] py-4 text-[14px] font-semibold text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-40 cursor-pointer"
        >
          {loading ? "Creating…" : "Create admin & calibrate thesis"}
        </button>
      </form>
    </AuthCard>
  );
}
