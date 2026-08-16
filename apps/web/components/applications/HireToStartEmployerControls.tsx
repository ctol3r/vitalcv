'use client';

/**
 * Employer controls for the joined hire-to-start case.
 *
 * Everything here drives the ONE application-bound start command through the
 * marketplace proxies: requirement progress/waiver → PATCH
 * /activation/requirements/:id, the explicit start-ready decision → POST
 * /start-ready, and the employer-confirmed actual first day → POST /start.
 * start-ready is an operational state — the copy never claims credentialing,
 * clearance, or institutional approval, and the confirm control appears only
 * AFTER an explicit start-ready decision (never inferred).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { HireToStartCase, HireToStartRequirement, HireToStartStage } from '@/lib/applications/hireToStart';

function messageOf(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const value = body as Record<string, unknown>;
  return typeof value.error === 'string'
    ? value.error
    : typeof value.error_description === 'string'
      ? value.error_description
      : fallback;
}

function progressStatus(status: string): { status: 'submitted' | 'met'; label: string } | null {
  if (status === 'submitted' || status === 'under_review') return { status: 'met', label: 'Mark met' };
  if (['not_started', 'requested', 'blocked', 'expired'].includes(status)) return { status: 'submitted', label: 'Mark submitted' };
  return null;
}

export function HireToStartEmployerControls({
  applicationId,
  decisionState,
  currentStage,
  requirements,
}: {
  applicationId: string;
  decisionState: NonNullable<HireToStartCase['decision']>['state'] | null;
  currentStage: HireToStartStage;
  requirements: HireToStartRequirement[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actualFirstDay, setActualFirstDay] = useState('');
  const openRequirements = requirements.filter((requirement) => (
    !['met', 'waived', 'not_applicable'].includes(requirement.status)
  ));
  const allRequiredResolved = requirements
    .filter((requirement) => requirement.necessity === 'required')
    .every((requirement) => ['met', 'waived', 'not_applicable'].includes(requirement.status));

  async function mutate(key: string, url: string, init: RequestInit, fallback: string) {
    setPending(key);
    setMessage(null);
    try {
      const response = await fetch(url, init);
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(messageOf(body, fallback));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : fallback);
    } finally {
      setPending(null);
    }
  }

  if (decisionState !== 'accepted_as_head_start' || currentStage === 'started') return null;

  return (
    <div className="mt-5 border-t border-white/10 pt-5" data-testid="hire-to-start-employer-controls">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">Employer controls</p>
      {openRequirements.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {openRequirements.map((requirement) => (
            <li key={requirement.id} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-white/80">{requirement.label}</p>
              <div className="flex gap-2">
                {progressStatus(requirement.status) ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending !== null}
                    onClick={() => {
                      const next = progressStatus(requirement.status);
                      if (!next) return;
                      void mutate(
                        `progress:${requirement.id}`,
                        `/api/applications/${applicationId}/activation/requirements/${requirement.id}`,
                        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toStatus: next.status }) },
                        'Requirement update failed.',
                      );
                    }}
                  >
                    {pending === `progress:${requirement.id}` ? 'Recording…' : progressStatus(requirement.status)?.label}
                  </Button>
                ) : null}
                {['not_started', 'requested', 'under_review', 'blocked'].includes(requirement.status) ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending !== null}
                    onClick={() => mutate(
                      `waive:${requirement.id}`,
                      `/api/applications/${applicationId}/activation/requirements/${requirement.id}`,
                      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toStatus: 'waived', reason: 'Authorized employer waiver.' }) },
                      'Requirement waiver failed.',
                    )}
                  >
                    {pending === `waive:${requirement.id}` ? 'Recording…' : 'Waive'}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {currentStage !== 'start_ready' ? (
        <div className="mt-4">
          <Button
            type="button"
            variant="success"
            disabled={pending !== null || !allRequiredResolved}
            onClick={() => mutate(
              'start-ready',
              `/api/applications/${applicationId}/start-ready`,
              { method: 'POST' },
              'Start-ready recording failed.',
            )}
          >
            {pending === 'start-ready' ? 'Recording…' : 'Record start-ready'}
          </Button>
          {!allRequiredResolved ? <p className="mt-2 text-xs text-white/50">Resolve every required item before recording start-ready.</p> : null}
        </div>
      ) : (
        <div className="mt-4 max-w-sm">
          <label htmlFor={`actual-first-day-${applicationId}`} className="text-xs text-white/60">Actual first day</label>
          <Input
            id={`actual-first-day-${applicationId}`}
            type="date"
            value={actualFirstDay}
            onChange={(event) => setActualFirstDay(event.target.value)}
            className="mt-2 border-white/15 bg-black/20 text-white"
          />
          <Button
            type="button"
            variant="success"
            className="mt-3"
            disabled={pending !== null || !actualFirstDay}
            onClick={() => mutate(
              'confirm-start',
              `/api/applications/${applicationId}/start`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ startedAt: `${actualFirstDay}T12:00:00.000Z` }),
              },
              'Actual first day confirmation failed.',
            )}
          >
            {pending === 'confirm-start' ? 'Confirming…' : 'Confirm actual first day'}
          </Button>
        </div>
      )}
      {message ? <p role="alert" className="mt-3 text-sm text-amber-200">{message}</p> : null}
    </div>
  );
}
