'use client';

/**
 * CoverLetterDrafter — generates an AI cover-letter DRAFT for an opportunity, grounded only in
 * the clinician's stated preferences and the public opportunity details. The draft is editable
 * and clearly labeled AI-generated. Honest states: not-configured, loading, error.
 */

import { useState } from 'react';
import { Sparkles, Copy, Check } from 'lucide-react';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { useAiEnabled } from '@/lib/ai/useAiEnabled';
import { useMatchaPreferences } from './useMatchaPreferences';
import { summarizeProfileForLetter, type CoverLetterOpportunity } from '@/lib/matcha/coverLetter';

const ACCENT = 'var(--vt-accent, #0A7B7F)';

type State = 'idle' | 'loading' | 'ready' | 'unconfigured' | 'error';

export function CoverLetterDrafter({ opportunity }: { opportunity: CoverLetterOpportunity }) {
  const { data } = useClinicianMobile();
  const person = data.workspace?.personProfile;
  const npi = person?.npi ?? undefined;
  const name = person?.firstName ?? undefined;
  const { preferences } = useMatchaPreferences(npi);
  const aiEnabled = useAiEnabled();

  const [state, setState] = useState<State>('idle');
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setState('loading');
    setMessage(null);
    try {
      const res = await fetch('/api/matcha/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunity,
          profileSummary: summarizeProfileForLetter(preferences, name),
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        draft?: string;
        configured?: boolean;
        error?: string;
      };
      if (payload.configured === false) {
        setState('unconfigured');
        return;
      }
      if (payload.error) {
        setMessage(payload.error);
        setState('error');
        return;
      }
      if (payload.draft) {
        setDraft(payload.draft);
        setState('ready');
        return;
      }
      setMessage('No draft was produced. Please try again.');
      setState('error');
    } catch {
      setMessage('Could not reach the drafting service. Please try again.');
      setState('error');
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  // Inert unless AI is configured — no dead affordance in prod when AI is off.
  if (!aiEnabled) return null;

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--vt-border, #EEF2F0)', paddingTop: 14 }}>
      {state === 'idle' || state === 'loading' ? (
        <button
          type="button"
          onClick={generate}
          disabled={state === 'loading'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 15px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: state === 'loading' ? 'default' : 'pointer', border: `1px solid ${ACCENT}`, background: `color-mix(in srgb, ${ACCENT} 8%, transparent)`, color: ACCENT, opacity: state === 'loading' ? 0.7 : 1 }}
        >
          <Sparkles size={14} aria-hidden="true" />
          {state === 'loading' ? 'Drafting…' : 'Draft a cover letter'}
        </button>
      ) : null}

      {state === 'unconfigured' ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--vt-text-secondary)', lineHeight: 1.5 }}>
          AI drafting isn&rsquo;t enabled in this environment yet.
        </p>
      ) : null}

      {state === 'error' ? (
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--vt-risk-high, #8C2A2A)' }}>{message}</p>
          <button type="button" onClick={generate} style={{ fontSize: 13, fontWeight: 600, color: ACCENT, background: 'transparent', border: 0, cursor: 'pointer', padding: 0 }}>
            Try again
          </button>
        </div>
      ) : null}

      {state === 'ready' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: ACCENT }}>
              AI draft — review before sending
            </span>
            <button type="button" onClick={copy} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--vt-text-primary)', background: 'transparent', border: 0, cursor: 'pointer' }}>
              {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            style={{ width: '100%', padding: '12px', fontSize: 14, lineHeight: 1.55, borderRadius: 10, border: '1px solid var(--vt-border, #D6DED9)', background: 'var(--vt-surface, #fff)', color: 'var(--vt-text-primary)', resize: 'vertical', fontFamily: 'inherit' }}
          />
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--vt-text-muted)', lineHeight: 1.5 }}>
            Generated from your stated preferences and this role&rsquo;s public details. It makes no
            claims about your credentials — edit before you send.
          </p>
          <button type="button" onClick={generate} style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: ACCENT, background: 'transparent', border: 0, cursor: 'pointer', padding: 0 }}>
            Regenerate
          </button>
        </div>
      ) : null}
    </div>
  );
}
