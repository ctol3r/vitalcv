'use client';

import type { ActivePersona } from '@/types/workspace';
import { cn } from '@/lib/utils';
import { BriefcaseMedical, Building2, Layers3 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type WorkspaceOption = {
  persona: ActivePersona;
  title: string;
  body: string;
  href: string;
  Icon: typeof BriefcaseMedical;
  tone: string;
};

const OPTIONS: WorkspaceOption[] = [
  {
    persona: 'CLINICIAN',
    title: "I'm a Clinician",
    body: 'Use your individual identity, passport, and trust-state workflow.',
    href: '/holder',
    Icon: BriefcaseMedical,
    tone: 'text-vt-success',
  },
  {
    persona: 'VERIFIER',
    title: "I'm an Employer / Verifier",
    body: 'Operate inside an organization workspace for hiring, verification, and review.',
    href: '/verifier',
    Icon: Building2,
    tone: 'text-vt-info',
  },
  {
    persona: 'BOTH',
    title: "I'm Both",
    body: 'Keep both personal and organization personas active, then switch without re-authenticating.',
    href: '/holder',
    Icon: Layers3,
    tone: 'text-vt-brand-primary',
  },
];

export default function WorkspaceSwitchPage() {
  const router = useRouter();
  const [pendingPersona, setPendingPersona] = useState<ActivePersona | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSwitch(option: WorkspaceOption) {
    try {
      setPendingPersona(option.persona);
      setError(null);

      const response = await fetch('/api/workspaces/switch', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ persona: option.persona }),
      });

      if (!response.ok) {
        throw new Error(`Workspace switch failed with HTTP ${response.status}`);
      }

      router.push(option.href);
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : 'Unable to switch workspace');
    } finally {
      setPendingPersona(null);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),transparent_32%),linear-gradient(180deg,rgba(7,12,19,0.98),rgba(3,7,13,1))] px-6 py-16 text-vt-neutral-100">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="body-sm uppercase tracking-[0.24em] text-vt-neutral-800">Workspace Graph</p>
          <h1 className="heading-lg mt-4 text-foreground">Choose the identity surface you want to operate in.</h1>
          <p className="body-sm mt-4 text-vt-neutral-200">
            VitalCV can hold your clinician identity, your organization workspace, or both. Pick a mode now and switch later without logging out.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {OPTIONS.map((option) => {
            const isPending = pendingPersona === option.persona;
            return (
              <button
                key={option.persona}
                type="button"
                className={cn(
                  'group flex min-h-72 flex-col rounded-3xl border border-vt-neutral-800 bg-vt-surface-ops-raised/75 p-6 text-left shadow-2xl shadow-black/20 transition hover:-translate-y-1 hover:border-vt-brand-primary/40 hover:bg-vt-surface-ops-raised',
                  isPending && 'border-vt-brand-primary/50',
                )}
                onClick={() => void handleSwitch(option)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className={cn('rounded-2xl bg-vt-surface-ops-base p-3 ring-1 ring-white/8', option.tone)}>
                    <option.Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <span className="body-sm rounded-full border border-vt-neutral-800 px-3 py-1 text-vt-neutral-200">
                    {option.persona}
                  </span>
                </div>

                <div className="mt-8">
                  <h2 className="heading-sm text-foreground">{option.title}</h2>
                  <p className="body-sm mt-3 text-vt-neutral-200">{option.body}</p>
                </div>

                <div className="mt-auto pt-8">
                  <span className="body-sm inline-flex items-center rounded-full bg-vt-surface-ops-base px-4 py-2 text-vt-neutral-100 ring-1 ring-white/8">
                    {isPending ? 'Switching...' : 'Enter workspace'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {error ? (
          <p className="body-sm mt-6 rounded-2xl border border-vt-warning/30 bg-vt-warning/10 px-4 py-3 text-vt-warning">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
