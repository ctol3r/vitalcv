'use client';

import * as React from 'react';

type FormState =
  | { phase: 'idle' }
  | { phase: 'sending' }
  | { phase: 'sent'; shareableUrl: string; emailSendChannel: 'clerk_magic_link' | 'shareable_url_only' }
  | { phase: 'error'; message: string };

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'read_only', label: 'Read-only' },
] as const;

export default function VerifierTeamInvitePage() {
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<'admin' | 'reviewer' | 'read_only'>('reviewer');
  const [state, setState] = React.useState<FormState>({ phase: 'idle' });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ phase: 'sending' });
    try {
      const res = await fetch('/api/verifier/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setState({ phase: 'error', message: body.message ?? `Invitation failed (${res.status}).` });
        return;
      }
      const data = (await res.json()) as {
        shareableUrl: string;
        emailSendChannel: 'clerk_magic_link' | 'shareable_url_only';
      };
      setState({
        phase: 'sent',
        shareableUrl: data.shareableUrl,
        emailSendChannel: data.emailSendChannel,
      });
    } catch {
      setState({ phase: 'error', message: 'Network error. Try again.' });
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Verifier team
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Invite a teammate</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Invitations are sent through Clerk hosted email. If email delivery is
          unavailable, a copyable invitation URL is returned instead.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4" aria-label="Invite teammate form">
        <div className="space-y-1">
          <label htmlFor="invite-email" className="text-xs font-medium">
            Teammate email
          </label>
          <input
            id="invite-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="invite-role" className="text-xs font-medium">
            Role
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'admin' | 'reviewer' | 'read_only')}
            className="w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={state.phase === 'sending' || !email}
          className="rounded-md border border-emerald-600/50 bg-emerald-600/10 px-4 py-2 text-sm font-medium text-emerald-300 disabled:opacity-50"
        >
          {state.phase === 'sending' ? 'Sending…' : 'Send invitation'}
        </button>
      </form>

      {state.phase === 'sent' && (
        <section className="mt-6 rounded-md border border-emerald-600/40 bg-emerald-600/10 p-4 text-sm" role="status">
          <p className="font-medium text-emerald-300">Invitation created.</p>
          <p className="mt-1 text-xs text-emerald-200/80">
            {state.emailSendChannel === 'clerk_magic_link'
              ? 'A magic-link email has been queued via Clerk.'
              : 'Email delivery was unavailable; share the URL below directly.'}
          </p>
          <p className="mt-2 break-all font-mono text-xs">{state.shareableUrl}</p>
        </section>
      )}

      {state.phase === 'error' && (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {state.message}
        </p>
      )}
    </main>
  );
}
