'use client';

/**
 * CareerProfileSharingCard — the holder's share-or-don't-share control for the
 * public career profile page (/profile/[npi]).
 *
 * Default is private: the public page 404s until the clinician explicitly
 * publishes. The toggle is a real audited mutation (career_profile_sharing_
 * updated) via POST /api/profile/sharing. Honest copy: publishing shares the
 * self-attested career story; the source-backed verification record at
 * /verify/[npi] is a separate, always-public surface.
 */

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Globe2, Loader2, Lock } from 'lucide-react';

type Visibility = 'public' | 'private';
type Phase = 'loading' | 'ready' | 'unavailable';

export function CareerProfileSharingCard({ npi }: { npi: string }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/profile/sharing', { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { careerProfile?: string };
        if (!cancelled) {
          setVisibility(body.careerProfile === 'public' ? 'public' : 'private');
          setPhase('ready');
        }
      } catch {
        if (!cancelled) setPhase('unavailable');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setSharing = useCallback(async (next: Visibility) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/sharing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ careerProfile: next }),
      });
      const body = (await res.json().catch(() => ({}))) as { careerProfile?: string; error?: unknown };
      if (!res.ok) {
        const message = typeof body.error === 'string'
          ? body.error
          : (body.error as { message?: string } | undefined)?.message;
        throw new Error(message ?? 'Could not update sharing.');
      }
      setVisibility(body.careerProfile === 'public' ? 'public' : 'private');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update sharing.');
    } finally {
      setSaving(false);
    }
  }, []);

  const publicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/profile/${npi}`
    : `/profile/${npi}`;

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed — copy the link text manually.');
    }
  }, [publicUrl]);

  if (phase === 'loading') {
    return (
      <section className="vcv-panel p-5" aria-label="Career profile sharing">
        <p className="vcv-mono flex items-center gap-2 text-xs vcv-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading sharing state…
        </p>
      </section>
    );
  }

  if (phase === 'unavailable') {
    return (
      <section className="vcv-panel p-5" aria-label="Career profile sharing">
        <h2 className="text-base font-medium">Public career profile</h2>
        <p className="mt-2 text-sm vcv-muted">
          Sharing controls are temporarily unavailable. Your profile stays private
          until you explicitly publish it.
        </p>
      </section>
    );
  }

  const isPublic = visibility === 'public';

  return (
    <section className="vcv-panel p-5" aria-label="Career profile sharing" data-testid="career-profile-sharing">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-medium">
            {isPublic ? <Globe2 className="h-4 w-4" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
            Public career profile
          </h2>
          <p className="mt-1 text-sm vcv-muted">
            {isPublic
              ? 'Anyone with the link can view your career profile page.'
              : 'Private — your career profile page is off. Only you can see this content.'}
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void setSharing(isPublic ? 'private' : 'public')}
          className="vcv-mono shrink-0 rounded-[6px] border px-3 py-2 text-[11px] uppercase tracking-[0.14em] transition disabled:opacity-50"
          style={{ borderColor: 'var(--ink)', color: isPublic ? 'var(--paper, #fff)' : 'var(--ink)', background: isPublic ? 'var(--ink)' : 'transparent' }}
        >
          {saving ? 'Saving…' : isPublic ? 'Make private' : 'Publish page'}
        </button>
      </div>

      {isPublic ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <code className="vcv-mono rounded-[6px] border px-3 py-2 text-xs" style={{ borderColor: 'var(--paper-edge)' }}>
            {publicUrl}
          </code>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="vcv-mono inline-flex items-center gap-1.5 rounded-[6px] border px-3 py-2 text-[11px] uppercase tracking-[0.12em]"
            style={{ borderColor: 'var(--paper-edge)' }}
          >
            {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <a
            href={`/profile/${npi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="vcv-mono inline-flex items-center gap-1.5 rounded-[6px] border px-3 py-2 text-[11px] uppercase tracking-[0.12em]"
            style={{ borderColor: 'var(--paper-edge)' }}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Preview
          </a>
        </div>
      ) : null}

      <p className="mt-3 text-xs vcv-muted">
        The page shows your self-attested career story, labeled as self-attested.
        Your source-backed verification record at /verify is a separate surface.
        Unpublishing takes effect immediately.
      </p>
      {error ? <p className="mt-2 text-xs" style={{ color: 'var(--warn, #b45309)' }}>{error}</p> : null}
    </section>
  );
}

export default CareerProfileSharingCard;
