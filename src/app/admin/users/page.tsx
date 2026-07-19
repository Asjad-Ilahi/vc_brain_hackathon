"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, postJson } from "../../_components/api";

type UserRow = { id: string; name: string; email: string; role: string; createdAt: string };
type InviteRow = {
  id: string;
  email: string;
  role: string;
  used: boolean;
  expiresAt: string;
  createdAt: string;
  link: string;
};

const ROLES = ["admin", "investor", "analyst", "viewer"] as const;
const ROLE_DESC: Record<string, string> = {
  admin: "Full access · provisions users",
  investor: "Configures thesis · deploys capital",
  analyst: "Runs diligence + drafts · cannot deploy",
  viewer: "Read-only (the public demo)",
};

export default function AdminUsersPage() {
  const [me, setMe] = useState<{ id: string; role: string } | null | undefined>(undefined);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("investor");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [u, i] = await Promise.all([
      api<{ users: UserRow[] }>("/api/users"),
      api<{ invites: InviteRow[] }>("/api/invites"),
    ]);
    setUsers(u.users);
    setInvites(i.invites);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api<{ user: { id: string; role: string } | null }>("/api/auth/me");
        if (cancelled) return;
        setMe(r.user);
        if (r.user?.role === "admin") await load();
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function changeRole(userId: string, role: string) {
    setError(null);
    setNotice(null);
    try {
      await api("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      await load();
      setNotice("Role updated.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const r = await postJson<{ invite: { email: string } }>("/api/invites", {
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteEmail("");
      setNotice(`Invite created for ${r.invite.email}. Share the link below · it works once.`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(link);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked · the field is selectable as a fallback */
    }
  }

  if (me === undefined) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f8fb] font-sans">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  if (!me || me.role !== "admin") {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f8fb] px-6 font-sans">
        <div className="u-card max-w-md rounded-[22px] p-8 text-center">
          <h1 className="text-[20px] font-extrabold text-ink">Admins only</h1>
          <p className="mt-2 text-[13.5px] text-muted">
            User management is restricted to administrators. Ask an admin to change your role if you
            need access.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-full bg-brand px-5 py-2.5 text-[13.5px] font-semibold text-white hover:brightness-110"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const pendingInvites = invites.filter((i) => !i.used);

  return (
    <div className="min-h-screen bg-[#f7f8fb] font-sans">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-[24px] font-extrabold tracking-tight text-ink">Team &amp; access</h1>
            <p className="mt-1 text-[13.5px] text-muted">
              Provision operators and set what each role can do. There is no public sign-up.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-full bg-white px-4 py-2.5 text-[13px] font-semibold text-ink u-card hover:text-brand"
          >
            ← Dashboard
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-bad/20 bg-badwash px-4 py-3 text-[13px] text-bad">
            {error}
          </div>
        )}
        {notice && (
          <div className="mb-4 rounded-2xl border border-brand/20 bg-brandfaint px-4 py-3 text-[13px] text-brand">
            {notice}
          </div>
        )}

        {/* Invite */}
        <section className="u-card mb-6 rounded-[22px] p-6">
          <h2 className="text-[15px] font-bold text-ink">Invite an operator</h2>
          <p className="mt-1 text-[12.5px] text-muted">
            Creates a single-use link. The invitee sets their own password and lands with the role
            you pick.
          </p>
          <form onSubmit={createInvite} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                Email
              </label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="operator@yourfund.vc"
                className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-[13.5px] text-ink outline-none focus:border-brand"
              />
            </div>
            <div className="sm:w-56">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-[13.5px] text-ink outline-none focus:border-brand"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-brand px-5 py-2.5 text-[13.5px] font-semibold text-white hover:brightness-110 disabled:opacity-40"
            >
              {busy ? "Creating…" : "Create invite"}
            </button>
          </form>
          <p className="mt-2 text-[12px] text-faint">{ROLE_DESC[inviteRole]}</p>
        </section>

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <section className="u-card mb-6 rounded-[22px] p-6">
            <h2 className="text-[15px] font-bold text-ink">Pending invites</h2>
            <div className="mt-3 flex flex-col gap-3">
              {pendingInvites.map((i) => (
                <div key={i.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-semibold text-ink">{i.email}</span>
                    <span className="rounded-full bg-panel px-2.5 py-0.5 text-[11px] font-semibold text-muted">
                      {i.role}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      readOnly
                      value={i.link}
                      onFocus={(e) => e.currentTarget.select()}
                      className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 py-1.5 font-mono text-[11.5px] text-muted"
                    />
                    <button
                      onClick={() => copy(i.link)}
                      className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-white hover:brightness-110"
                    >
                      {copied === i.link ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Users */}
        <section className="u-card rounded-[22px] p-6">
          <h2 className="text-[15px] font-bold text-ink">Operators ({users.length})</h2>
          <div className="mt-3 flex flex-col divide-y divide-line">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-semibold text-ink">
                    {u.name}
                    {u.id === me.id && <span className="ml-2 text-[11px] text-faint">(you)</span>}
                  </div>
                  <div className="truncate text-[12px] text-muted">{u.email}</div>
                </div>
                <select
                  value={u.role}
                  disabled={u.id === me.id}
                  onChange={(e) => changeRole(u.id, e.target.value)}
                  title={u.id === me.id ? "You can't change your own role" : ROLE_DESC[u.role]}
                  className="shrink-0 rounded-xl border border-line bg-white px-3 py-2 text-[13px] font-semibold text-ink outline-none focus:border-brand disabled:opacity-50"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
