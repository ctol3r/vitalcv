'use client';

import { useState } from 'react';

/**
 * ShareBundleCard — the employer-review bundle share, ported from the retired
 * /passport/[id] wallet (founder decision 2026-08-07: /passport retired; this
 * was its one capability with no other home).
 *
 * POST /api/apply/share generates an /apply/{bundleId} link and writes a
 * BundleShareEvent to the audit log for KPI tracking — the request body is
 * verbatim from the retired PassportWallet so the KPI stream is continuous.
 * The endpoint requires a session; this card lives on /holder, which the
 * layout already gates, so the 401 branch is defensive only.
 */
export function ShareBundleCard({ npi }: { npi: string }) {
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleShare() {
    setSharing(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch('/api/apply/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          npi,
          organization_context: {
            organization_id: 'pilot-manual-share',
            name: 'Employer Review (Link Share)',
            purpose_of_use: 'Pilot Ops manual share link generation',
          },
        }),
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error('Sign in to generate a shareable review link.');
        if (res.status === 404) throw new Error('No record found for this NPI yet.');
        throw new Error('Could not generate a review link. Try again.');
      }

      const data = (await res.json()) as { bundleId?: string; bundleUrl?: string; error?: string };
      if (!data.bundleId) throw new Error(data.error ?? 'Link generation failed.');

      const url = data.bundleUrl ?? `${window.location.origin}/apply/${data.bundleId}`;
      setShareUrl(url);
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Share failed.');
    } finally {
      setSharing(false);
    }
  }

  return (
    <div
      data-share-bundle-card=""
      className="rounded-[28px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5 shadow-sm sm:p-6"
    >
      <h3 className="text-base font-semibold text-foreground">Employer review link</h3>
      <p className="mt-1 text-sm leading-6 text-[var(--vt-text-secondary)]">
        Generate a read-only review bundle an employer can open at a single link. The share is
        recorded, and the record it shows stays yours.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => void handleShare()}
          disabled={sharing}
          className="inline-flex min-h-[46px] items-center justify-center rounded-xl bg-[var(--vt-accent-editorial,#4338CA)] px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {sharing ? 'Generating link…' : 'Generate review link'}
        </button>
        {shareUrl ? (
          <p className="min-w-0 break-all text-xs text-[var(--vt-text-secondary)]">
            {shareUrl}
            {copied ? <span className="ml-2 font-semibold text-foreground">Copied</span> : null}
          </p>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-[var(--vt-risk-high)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default ShareBundleCard;
