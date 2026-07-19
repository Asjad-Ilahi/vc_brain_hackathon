"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, postJson } from "../../_components/api";
import AuthCard from "../../_components/AuthCard";
import { inputCls, labelCls } from "../../_components/ui";

/**
 * Public invite-acceptance screen. Validates the token, shows the invitee which
 * email + role they're accepting, then provisions the account and signs them in.
 */
export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params?.token ?? "");

  const [checking, setChecking] = useState(true);
  const [info, setInfo] = useState<{ email: string; role: string } | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api<{ email: string; role: string }>(
          `/api/invites/accept?token=${encodeURIComponent(token)}`
        );
        if (!cancelled) {
          setInfo(r);
          setChecking(false);
        }
      } catch (e) {
        if (!cancelled) {
          setInvalid((e as Error).message);
          setChecking(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await postJson("/api/invites/accept", { token, name, password });
      router.replace("/dashboard");
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper font-sans text-[#000000]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#0045FF] border-t-transparent" />
          <p className="text-[13px] tracking-wide text-gray-500 font-mono">Checking your invite…</p>
        </div>
      </div>
    );
  }

  if (invalid || !info) {
    return (
      <AuthCard
        eyebrow="Invite"
        title="This invite can't be used"
        sub={invalid ?? "The link is invalid."}
        footer={
          <>
            Need access?{" "}
            <a href="/admin" className="text-[#0045FF] hover:underline font-semibold">
              Sign in
            </a>
          </>
        }
      >
        <div />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow="Accept invite"
      title="Set up your account"
      sub={`You've been invited as ${info.email} with the "${info.role}" role. Choose a password to continue.`}
      footer={
        <>
          Already have an account?{" "}
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
          placeholder="Your name"
          className={inputCls}
          autoComplete="name"
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
          {loading ? "Setting up…" : "Accept & enter workspace"}
        </button>
      </form>
    </AuthCard>
  );
}
