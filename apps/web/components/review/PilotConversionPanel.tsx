'use client';
/**
 * Pilot Conversion Panel — wave-135
 *
 * Sits below the action rail on /review.
 * One CTA: "Start Pilot". No demo. No ambiguity.
 * Minimal form: org name + email. That's it.
 */

import { useState, useCallback } from 'react';
import type { ReadinessPosture, LaneSnapshot } from '@/components/proof/trust-types';

// ─── Types ────────────────────────────────────────────────────────

export interface PilotRequest {
  org: string;
  contactEmail: string;
  timestamp: number;
  sourceEntityId: string;
  sourceNpi: string;
  decisionState: string;
  posture: ReadinessPosture;
  blockerCount: number;
  proofTier: string;
  score: number | null;
  lanes: Array<{ laneId: string; status: string }>;
}

interface PanelProps {
  entityId: string;
  npi: string;
  posture: ReadinessPosture;
  proofTier: string;
  score: number | null;
  decisionState: string;
  blockerCount: number;
  lanes: LaneSnapshot[];
}

type PanelState = 'idle' | 'form' | 'submitting' | 'done';

// ─── Component ────────────────────────────────────────────────────

export function PilotConversionPanel({
  entityId, npi, posture, proofTier, score, decisionState, blockerCount, lanes,
}: PanelProps) {
  const [state, setState] = useState<PanelState>('idle');
  const [org, setOrg] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!org.trim() || !email.trim() || !email.includes('@')) {
      setError('Organization name and valid email required.');
      return;
    }
    setError(null);
    setState('submitting');

    const request: PilotRequest = {
      org: org.trim(),
      contactEmail: email.trim(),
      timestamp: Date.now(),
      sourceEntityId: entityId,
      sourceNpi: npi,
      decisionState,
      posture,
      blockerCount,
      proofTier,
      score,
      lanes: lanes.map(l => ({ laneId: l.laneId, status: l.status })),
    };

    try {
      await fetch('/api/pilot-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      // Also log ISV event
      await fetch('/api/isv-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          npi,
          eventType: 'action.taken',
          payload: { action: 'pilot_requested', org: org.trim() },
        }),
      }).catch(() => {});

      setState('done');
    } catch {
      setError('Submission failed. Email chris@vitalcv.com directly.');
      setState('form');
    }
  }, [org, email, entityId, npi, decisionState, posture, blockerCount, proofTier, score, lanes]);

  // ── Done state ──────────────────────────────────────────────────
  if (state === 'done') {
    return (
      <div className="border border-green-200 bg-green-50 rounded-xl px-5 py-4">
        <p className="text-sm font-bold text-green-800 mb-1">Pilot initiated.</p>
        <p className="text-xs text-green-700">We'll follow up within 24 hours at {email}.</p>
        <p className="text-[10px] text-green-600 mt-2 font-mono">
          Context: {decisionState} · {posture} · {blockerCount} blocker{blockerCount !== 1 ? 's' : ''} · NPI {npi}
        </p>
      </div>
    );
  }

  // ── Form state ──────────────────────────────────────────────────
  if (state === 'form' || state === 'submitting') {
    return (
      <div className="border border-slate-200 rounded-xl px-5 py-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Start Pilot</p>
        <p className="text-xs text-slate-500">
          We'll run this on your current onboarding cases and measure the delta.
        </p>
        <input
          type="text"
          placeholder="Organization name"
          value={org}
          onChange={e => { setOrg(e.target.value); setError(null); }}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-400"
          disabled={state === 'submitting'}
        />
        <input
          type="email"
          placeholder="Your email"
          value={email}
          onChange={e => { setEmail(e.target.value); setError(null); }}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-400"
          disabled={state === 'submitting'}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={state === 'submitting'}
          className="w-full bg-slate-900 hover:bg-slate-700 text-white font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {state === 'submitting' ? 'Submitting…' : 'Start Pilot'}
        </button>
        <button
          onClick={() => setState('idle')}
          className="w-full text-xs text-slate-400 hover:text-slate-600 transition-colors"
          disabled={state === 'submitting'}
        >
          Cancel
        </button>
      </div>
    );
  }

  // ── Idle state ──────────────────────────────────────────────────
  return (
    <div className="border border-slate-200 rounded-xl px-5 py-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Try This With Your Team</p>
      <p className="text-sm text-slate-700 leading-relaxed">
        Run this on 5–10 clinicians and measure your time-to-start.
      </p>
      <ul className="space-y-1.5 text-xs text-slate-600">
        <li className="flex gap-2"><span className="text-green-600">✓</span> No integration required</li>
        <li className="flex gap-2"><span className="text-green-600">✓</span> You keep your existing process</li>
        <li className="flex gap-2"><span className="text-green-600">✓</span> We measure the delta</li>
      </ul>
      <button
        onClick={() => setState('form')}
        className="w-full bg-slate-900 hover:bg-slate-700 text-white font-bold py-3 rounded-lg text-sm uppercase tracking-wider transition-colors"
      >
        Start Pilot
      </button>
    </div>
  );
}
