'use client';

/**
 * MatchAiSummary — an OPTIONAL, grounded AI "why this role fits you" note for a
 * matched opportunity. Renders NOTHING unless AI is enabled (useAiEnabled), so
 * there is no dead affordance in prod. When enabled, it summarizes ONLY the
 * deterministic engine's fit signals + the clinician's stated summary — it never
 * fabricates a score or credential, and the deterministic reasons always remain
 * shown above it. Mirrors CoverLetterDrafter's honest states.
 */

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAiEnabled } from '@/lib/ai/useAiEnabled';

const ACCENT = 'var(--vt-accent, #0A7B7F)';

type State = 'idle' | 'loading' | 'ready' | 'error';

export interface MatchAiSummaryProps {
  opportunity: { title?: string; organization?: string; specialty?: string; location?: string };
  matchBand?: string;
  fitReasons?: Array<{ label: string; positive: boolean }>;
  blockers?: Array<{ label: string; severity?: string }>;
  profileSummary?: string;
}

export function MatchAiSummary(props: MatchAiSummaryProps) {
  const aiEnabled = useAiEnabled();
  const [state, setState] = useState<State>('idle');
  const [summary, setSummary] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  // Inert unless AI is configured — nothing renders (deterministic reasons stay).
  if (!aiEnabled) return null;

  async function generate() {
    setState('loading');
    setMessage(null);
    try {
      const res = await fetch('/api/matcha/explain-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunity: props.opportunity,
          matchBand: props.matchBand,
          fitReasons: props.fitReasons,
          blockers: props.blockers,
          profileSummary: props.profileSummary,
        }),
      });
      const p = (await res.json().catch(() => ({}))) as {
        summary?: string;
        configured?: boolean;
        error?: string;
      };
      if (p.configured === false) {
        // Key was removed between probe and call — degrade silently.
        setState('idle');
        return;
      }
      if (p.error) {
        setMessage(p.error);
        setState('error');
        return;
      }
      if (p.summary) {
        setSummary(p.summary);
        setState('ready');
        return;
      }
      setMessage('No summary was produced.');
      setState('error');
    } catch {
      setMessage('Could not reach the summary service.');
      setState('error');
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      {state === 'idle' || state === 'loading' ? (
        <button
          type="button"
          onClick={generate}
          disabled={state === 'loading'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 13px',
            borderRadius: 999,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: state === 'loading' ? 'default' : 'pointer',
            border: `1px solid ${ACCENT}`,
            background: `color-mix(in srgb, ${ACCENT} 8%, transparent)`,
            color: ACCENT,
            opacity: state === 'loading' ? 0.7 : 1,
          }}
        >
          <Sparkles size={13} aria-hidden="true" />
          {state === 'loading' ? 'Summarizing…' : 'Why this fits you'}
        </button>
      ) : null}

      {state === 'error' ? (
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 12.5, color: 'var(--vt-risk-high, #8C2A2A)' }}>{message}</p>
          <button
            type="button"
            onClick={generate}
            style={{ fontSize: 12.5, fontWeight: 600, color: ACCENT, background: 'transparent', border: 0, cursor: 'pointer', padding: 0 }}
          >
            Try again
          </button>
        </div>
      ) : null}

      {state === 'ready' ? (
        <div>
          <span
            style={{
              display: 'block',
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: ACCENT,
              marginBottom: 5,
            }}
          >
            From your match signals
          </span>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: 'var(--vt-text-secondary)' }}>{summary}</p>
          <button
            type="button"
            onClick={generate}
            style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: ACCENT, background: 'transparent', border: 0, cursor: 'pointer', padding: 0 }}
          >
            Regenerate
          </button>
        </div>
      ) : null}
    </div>
  );
}
