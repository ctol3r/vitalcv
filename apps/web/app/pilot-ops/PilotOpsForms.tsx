'use client';

import { type FormEvent, useState } from 'react';

type StartOutcomeState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'success'; entityId: string; startedAt: string }
  | { kind: 'error'; message: string };

function todayValue(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

export function ScopeFilterForm({
  days,
  initialOrg,
  initialPilotId,
  initialLane,
}: {
  days: number;
  initialOrg: string;
  initialPilotId: string;
  initialLane: string;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    params.set('days', String(days));

    const org = String(formData.get('org') ?? '').trim();
    const pilotId = String(formData.get('pilotId') ?? '').trim();
    const lane = String(formData.get('lane') ?? '').trim();

    if (org) {
      params.set('org', org);
    }
    if (pilotId) {
      params.set('pilotId', pilotId);
    }
    if (lane) {
      params.set('lane', lane);
    }

    window.location.assign(`/pilot-ops?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Org Context ID</span>
        <input
          name="org"
          type="text"
          defaultValue={initialOrg}
          placeholder="org_context_123"
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-white/20"
        />
      </label>
      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Pilot ID</span>
        <input
          name="pilotId"
          type="text"
          defaultValue={initialPilotId}
          placeholder="pilot_first_wave"
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-white/20"
        />
      </label>
      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Workflow Lane</span>
        <input
          name="lane"
          type="text"
          defaultValue={initialLane}
          placeholder="icu_travel"
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-white/20"
        />
      </label>
      <div className="flex items-end gap-2">
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/[0.14]"
        >
          Apply Scope
        </button>
        <a
          href={`/pilot-ops?days=${days}`}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-white/55 transition hover:text-white"
        >
          Clear
        </a>
      </div>
    </form>
  );
}

export function StartOutcomeForm() {
  const [entityId, setEntityId] = useState('');
  const [startedAt, setStartedAt] = useState(todayValue);
  const [note, setNote] = useState('');
  const [state, setState] = useState<StartOutcomeState>({ kind: 'idle' });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEntityId = entityId.trim();
    const trimmedNote = note.trim();

    if (!trimmedEntityId) {
      setState({ kind: 'error', message: 'entityId is required.' });
      return;
    }

    if (!isValidDateInput(startedAt)) {
      setState({ kind: 'error', message: 'startedAt must be a valid date.' });
      return;
    }

    setState({ kind: 'pending' });

    try {
      const response = await fetch('/api/internal/pilot/start-outcome', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityId: trimmedEntityId,
          startedAt: new Date(`${startedAt}T00:00:00.000Z`).toISOString(),
          note: trimmedNote || undefined,
        }),
      });

      const payload = await response.json().catch(() => null) as {
        entityId?: string;
        startedAt?: string;
        error?: string;
      } | null;

      if (!response.ok) {
        setState({
          kind: 'error',
          message: payload?.error ?? 'Unable to record start outcome.',
        });
        return;
      }

      setEntityId('');
      setStartedAt(todayValue());
      setNote('');
      setState({
        kind: 'success',
        entityId: payload?.entityId ?? trimmedEntityId,
        startedAt,
      });
    } catch (error) {
      setState({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to record start outcome.',
      });
    }
  }

  const disabled = state.kind === 'pending';

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <div className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">Record Start Outcome</p>
        <p className="mt-1 text-xs text-white/30">
          Manual operator capture for a confirmed clinician start.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto]">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Entity ID</span>
          <input
            value={entityId}
            onChange={(event) => setEntityId(event.target.value)}
            type="text"
            inputMode="text"
            placeholder="00000000-0000-0000-0000-000000000000"
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-white/20"
            disabled={disabled}
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Started At</span>
          <input
            value={startedAt}
            onChange={(event) => setStartedAt(event.target.value)}
            type="date"
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition focus:border-white/20"
            disabled={disabled}
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Note</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            type="text"
            placeholder="Optional operator note"
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-white/20"
            disabled={disabled}
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={disabled}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:text-white/40"
          >
            {disabled ? 'Recording...' : 'Record Start'}
          </button>
        </div>
      </form>

      <div aria-live="polite" className="mt-3 min-h-5 text-sm">
        {state.kind === 'success' && (
          <p className="text-white/75">
            Recorded — entityId {state.entityId} started on {state.startedAt}
          </p>
        )}
        {state.kind === 'error' && <p className="text-white/60">{state.message}</p>}
      </div>
    </div>
  );
}
