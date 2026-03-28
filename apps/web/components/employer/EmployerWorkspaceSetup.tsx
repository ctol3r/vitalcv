'use client';

/**
 * EmployerWorkspaceSetup — minimal bootstrap for an employer workspace.
 *
 * When a pilot employer tries to create an org context but their Clerk user
 * isn't yet registered as a VcvEntity, this panel collects just the org name
 * and calls POST /api/employer/setup to upsert the profile.
 *
 * After success, the parent can retry the review-context creation.
 *
 * Scope: pilot-minimal. Gets an employer unblocked. Full admin workspace is separate.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

interface Props {
  /** Called after a successful setup so the parent can retry. */
  onSetupComplete: (orgName: string) => void;
  /** Optional hint text to show above the form. */
  hint?: string;
}

type SetupPhase = 'form' | 'loading' | 'done' | 'error';

export function EmployerWorkspaceSetup({ onSetupComplete, hint }: Props) {
  const [orgName, setOrgName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [phase, setPhase] = useState<SetupPhase>('form');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = orgName.trim();
    if (!trimmed) {
      setNameError('Organization name is required.');
      return;
    }
    setNameError(null);
    setPhase('loading');
    setErrorMsg(null);

    try {
      const res = await fetch('/api/employer/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });

      const data = await res.json() as { organizationId?: string; error?: string };

      if (!res.ok) {
        const msg = data.error ?? 'Setup failed. Try again.';
        setErrorMsg(msg);
        setPhase('error');
        return;
      }

      setPhase('done');
      onSetupComplete(trimmed);
    } catch {
      setErrorMsg('Setup request failed. Check your connection and try again.');
      setPhase('error');
    }
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      <Card className="rounded-xl border-amber-500/20 bg-amber-500/8 px-4 py-3 shadow-none">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300/70">
          Employer workspace required
        </p>
        <p className="mt-1 text-xs text-white/50 leading-relaxed">
          {hint ?? 'Your account needs an employer workspace to create review contexts. Set one up now to continue.'}
        </p>
      </Card>

      {phase === 'form' || phase === 'error' ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="org-name" className="text-xs text-white/40 mb-1 block">
              Organization name
            </label>
            <Input
              id="org-name"
              type="text"
              value={orgName}
              onChange={e => {
                setOrgName(e.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder="Hospital name, practice, or organization"
              className="h-12 w-full rounded-xl border-white/12 bg-white/6 px-4 text-sm text-white placeholder:text-white/25 shadow-none focus-visible:border-white/30 focus-visible:ring-white/10"
            />
            {nameError && (
              <p className="mt-1 text-xs text-red-400/70">{nameError}</p>
            )}
          </div>

          {errorMsg && (
            <Card className="rounded-xl border-rose-500/20 bg-rose-500/8 px-3 py-2 shadow-none">
              <p className="text-xs text-rose-300/80">{errorMsg}</p>
            </Card>
          )}

          <Button
            type="submit"
            variant="outline"
            disabled={!orgName.trim()}
            className="h-11 w-full rounded-xl border-white/15 bg-white/5 text-sm font-medium text-white/70 hover:border-white/25 hover:bg-white/8 hover:text-white disabled:opacity-40"
          >
            Set up employer workspace
          </Button>
          <p className="text-center text-white/20 text-[10px] leading-relaxed">
            This registers your account as an employer workspace. You can add more details later.
          </p>
        </form>
      ) : phase === 'loading' ? (
        <Card className="rounded-xl border-white/8 bg-white/3 px-4 py-4 shadow-none text-center">
          <p className="text-white/45 text-sm">Setting up workspace…</p>
        </Card>
      ) : null}
    </div>
  );
}
