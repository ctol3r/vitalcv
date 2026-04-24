import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ApplyBundleView, type ApplyBundle } from '@/components/apply/ApplyBundleView';

interface Props {
  params: Promise<{ bundleId: string }>;
}

const BACKEND = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000'
).replace(/\/$/, '');

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { bundleId } = await params;
  return {
    title: 'Employer Review',
    description: `Verified credential bundle ${bundleId} — powered by VitalCV Trust Infrastructure.`,
    robots: { index: false },
  };
}

type BundleReason = 'expired' | 'revoked' | 'not_found' | 'error';

type BundleResult =
  | { ok: true; bundle: ApplyBundle }
  | { ok: false; reason: BundleReason };

async function fetchBundle(bundleId: string): Promise<BundleResult> {
  try {
    const res = await fetch(`${BACKEND}/api/apply/bundle/${bundleId}`, {
      next: { revalidate: 0 },
    });
    if (res.status === 410) {
      const body = await res.json().catch(() => null) as { error_code?: string } | null;
      if (body?.error_code === 'share_revoked') return { ok: false, reason: 'revoked' };
      return { ok: false, reason: 'expired' };
    }
    if (res.status === 404) return { ok: false, reason: 'not_found' };
    if (!res.ok) return { ok: false, reason: 'error' };
    const bundle = await res.json() as ApplyBundle;
    if (new Date(bundle.expiresAt) < new Date()) return { ok: false, reason: 'expired' };
    return { ok: true, bundle };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export default async function ApplyBundlePage({ params }: Props) {
  const { bundleId } = await params;
  const result = await fetchBundle(bundleId);

  if (!result.ok) {
    return <BundleErrorView reason={result.reason} bundleId={bundleId} />;
  }

  return <ApplyBundleView bundle={result.bundle} />;
}

function BundleErrorView({ reason, bundleId }: { reason: BundleReason; bundleId: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ops-gradient px-4 text-foreground">
      <div className="w-full max-w-sm space-y-4 text-center">
        {reason === 'expired' && (
          <>
            <h1 className="text-xl font-bold text-foreground">This employer review snapshot has expired</h1>
            <p className="text-sm text-muted-foreground">Employer review snapshots are valid for 24 hours.</p>
            <div className="flex flex-col gap-2 pt-2">
              <Link href="/passport" className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-muted border border-border px-6 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
                Start a new NPI lookup
              </Link>
              <Link href="/passport" className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/6 px-6 text-sm text-foreground/70 transition-colors hover:text-foreground">
                Back to passport
              </Link>
            </div>
          </>
        )}

        {reason === 'revoked' && (
          <>
            <h1 className="text-xl font-bold text-foreground">This employer review link was revoked</h1>
            <p className="text-sm text-muted-foreground">Ask the clinician or recruiting team to send a new employer review link.</p>
            <div className="flex flex-col gap-2 pt-2">
              <Link href="/passport" className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-muted border border-border px-6 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
                Start a new NPI lookup
              </Link>
              <Link href="/passport" className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/6 px-6 text-sm text-foreground/70 transition-colors hover:text-foreground">
                Back to passport
              </Link>
            </div>
          </>
        )}

        {reason === 'not_found' && (
          <>
            <h1 className="text-xl font-bold text-foreground">Link not found</h1>
            <p className="text-sm text-muted-foreground">This link is invalid or has been revoked.</p>
            <div className="flex flex-col gap-2 pt-2">
              <Link href="/passport" className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-muted border border-border px-6 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
                Start a new NPI lookup
              </Link>
            </div>
          </>
        )}

        {reason === 'error' && (
          <>
            <h1 className="text-xl font-bold text-foreground">Snapshot unavailable</h1>
            <p className="text-sm text-muted-foreground">We could not load this employer review snapshot right now.</p>
            <div className="flex flex-col gap-2 pt-2">
              <Link href={`/apply/${bundleId}`} className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-muted border border-border px-6 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
                Try this review link again
              </Link>
              <Link href="/passport" className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/6 px-6 text-sm text-foreground/70 transition-colors hover:text-foreground">
                Start a new NPI lookup
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
