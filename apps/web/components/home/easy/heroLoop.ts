'use client';

/**
 * useHeroLoop — the homepage's one source of truth for the live NPI lookup
 * (amendment F; lifted unchanged from the amendment E hero so BOTH the hero
 * entry and the resolution scene can read it).
 *
 * Nothing about the pipeline changes here: same `useCareerLoop`, same real
 * `/api/identity/bootstrap` + `/api/trust-state` pairing, same capsule. This
 * is composition — who gets to render the result. The v4 recomposition moves
 * the result from the hero's stage column into the resolution scene's ledger,
 * which is the frame that was already drawing an illustration of it.
 */

import { useCallback, useState } from 'react';

import { useCareerLoop } from '@/lib/career-loop/useCareerLoop';
import { writeNpiHandoff } from '@/lib/onboarding/npiHandoff';

export function useHeroLoop() {
  const { state, onInput, submit, reset } = useCareerLoop();
  const [raw, setRaw] = useState('');
  // Recognition pacing (UX-05): `settled` goes false the moment a submit
  // starts and true only when the narration's floor elapses — the reveal
  // never beats the narration, and fast networks still get the beat. Under
  // prefers-reduced-motion the floor is zero (the pacing hook settles
  // instantly), which preserves the immediate result exactly.
  const [settled, setSettled] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  const resolving = state.phase === 'resolving';
  const narrating = resolving || !settled;

  const handleChange = (value: string) => {
    const next = value.replace(/\D/g, '').slice(0, 10);
    setRaw(next);
    onInput(next);
  };

  const handleSubmit = () => {
    if (resolving) return;
    setSettled(false);
    setAttempt((a) => a + 1);
    void submit(raw);
    // Bring the resolution scene into view so the read log and the returned
    // record are what the visitor is looking at. The browser owns the scroll;
    // reduced motion gets an instant jump instead of a glide.
    if (typeof document !== 'undefined') {
      const target = document.getElementById('record');
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }
  };

  const handleSettled = useCallback(() => setSettled(true), []);
  const handleReset = useCallback(() => {
    setRaw('');
    reset();
  }, [reset]);

  const profile = state.outcome === 'individual' ? state.profile : null;
  const handleKeep = useCallback(() => {
    if (profile) writeNpiHandoff(profile.npi);
  }, [profile]);

  return {
    state, raw, digits, resolving, narrating, attempt, profile,
    handleChange, handleSubmit, handleSettled, handleReset, handleKeep,
  };
}

export type HeroLoop = ReturnType<typeof useHeroLoop>;
