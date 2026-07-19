"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { postJson } from "../_components/api";
import { inputCls, labelCls } from "../_components/ui";
import AuthCard from "../_components/AuthCard";

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignIn />
    </Suspense>
  );
}

function SignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const r = await postJson<{ onboarded: boolean }>("/api/auth/login", { email, password });
      const next = params.get("next");
      router.push(r.onboarded ? (next && next.startsWith("/") ? next : "/dashboard") : "/onboarding");
    } catch (e2) {
      setErr((e2 as Error).message);
      setLoading(false);
    }
  }

  return (
    <AuthCard
      eyebrow="Sign in"
      title="Welcome back."
      sub="Your pipeline kept running — the radar scans on a schedule."
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit}>
        <label className={labelCls}>Work email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="lena@fund.group" type="email" autoComplete="email" />
        <label className={`mt-4 ${labelCls}`}>Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} type="password" autoComplete="current-password" />
        {err ? <p className="mt-3 text-[12px] text-bad">{err}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full bg-accent px-4 py-2.5 font-mono text-[12.5px] font-semibold uppercase tracking-wide text-accentink hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in →"}
        </button>
      </form>
    </AuthCard>
  );
}
