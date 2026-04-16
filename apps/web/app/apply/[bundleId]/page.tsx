/**
 * Wave 246: Apply-with-VitalCV — Public Bundle View Page
 *
 * Server component. Fetches the bundle from the backend and renders
 * ApplyBundleView. Shows an expiry/error message if the bundle is invalid.
 */

import type { Metadata } from 'next';
import { ApplyBundleView } from '@/components/apply/ApplyBundleView';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BundleCredential {
  type: string;
  issuer: string;
  status: string;
  verifiedAt: string | null;
  expiresAt: string | null;
}

interface IssuerProvenance {
  issuerId: string;
  name: string;
  trustScore: number;
}

interface ApplyBundle {
  bundleId: string;
  entityId?: string | null;
  npi: string;
  clinicianName: string;
  trustState: {
    readiness_level: string;
    readiness_score: number;
    readiness_status: string;
    computed_at: string;
  };
  credentials: BundleCredential[];
  issuerProvenance: IssuerProvenance[];
  monitoringStatus: 'active' | 'inactive' | 'partial';
  profileUrl: string;
  generatedAt: string;
  expiresAt: string;
  signature: string;
}

interface Props {
  params: Promise<{ bundleId: string }>;
}

// ── Backend URL ───────────────────────────────────────────────────────────────

const BACKEND = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000'
).replace(/\/$/, '');

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { bundleId } = await params;
  return {
    title: 'Credential Bundle',
    description: `Verified credential bundle ${bundleId} — powered by VitalCV Trust Infrastructure.`,
    robots: { index: false },
  };
}

// ── Data fetch ────────────────────────────────────────────────────────────────

type BundleResult =
  | { ok: true; bundle: ApplyBundle }
  | { ok: false; reason: 'expired' | 'not_found' | 'error' };

async function fetchBundle(bundleId: string): Promise<BundleResult> {
  try {
    const res = await fetch(`${BACKEND}/api/apply/bundle/${bundleId}`, {
      next: { revalidate: 0 },
    });
    if (res.status === 410) return { ok: false, reason: 'expired' };
    if (res.status === 404) return { ok: false, reason: 'not_found' };
    if (!res.ok) return { ok: false, reason: 'error' };
    const bundle = await res.json() as ApplyBundle;
    // Client-side expiry guard
    if (new Date(bundle.expiresAt) < new Date()) return { ok: false, reason: 'expired' };
    return { ok: true, bundle };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ApplyBundlePage({ params }: Props) {
  const { bundleId } = await params;
  const result = await fetchBundle(bundleId);

  if (!result.ok) {
    return <BundleErrorView reason={result.reason} retryHref={`/apply/${bundleId}`} />;
  }

  return <ApplyBundleView bundle={result.bundle} />;
}

// ── Error states ──────────────────────────────────────────────────────────────

function BundleErrorView({
  reason,
  retryHref,
}: {
  reason: 'expired' | 'not_found' | 'error';
  retryHref: string;
}) {
  const messages = {
    expired: {
      emoji: '⏱',
      title: 'This link has expired',
      body: 'Passport links are valid for 24 hours.',
      primaryLabel: 'Return to your passport',
      primaryHref: '/holder',
      secondaryLabel: 'Start a new NPI lookup',
      secondaryHref: '/passport',
    },
    not_found: {
      emoji: '🔍',
      title: 'Link not found',
      body: 'This link is invalid or has been revoked.',
      primaryLabel: 'Start a new NPI lookup',
      primaryHref: '/passport',
      secondaryLabel: null,
      secondaryHref: null,
    },
    error: {
      emoji: '⚠️',
      title: 'Connection interrupted',
      body: 'We could not load this passport right now. Try again in a moment.',
      primaryLabel: 'Try again',
      primaryHref: retryHref,
      secondaryLabel: 'Start a new NPI lookup',
      secondaryHref: '/passport',
    },
  };

  const msg = messages[reason];

  return (
    <div className="flex min-h-screen items-center justify-center bg-ops-gradient px-4 text-foreground">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="text-5xl">{msg.emoji}</div>
        <h1 className="text-xl font-bold text-foreground">{msg.title}</h1>
        <p className="text-sm text-muted-foreground">{msg.body}</p>
        <div className="flex flex-col gap-2 pt-2">
          <a
            href={msg.primaryHref}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-muted border border-border px-6 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            {msg.primaryLabel}
          </a>
          {msg.secondaryHref && (
            <a
              href={msg.secondaryHref}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/6 px-6 text-sm text-foreground/70 transition-colors hover:text-foreground"
            >
              {msg.secondaryLabel}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
