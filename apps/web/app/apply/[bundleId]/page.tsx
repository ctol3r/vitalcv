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
    title: 'VitalCV Credential Bundle',
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
    return <BundleErrorView reason={result.reason} />;
  }

  return <ApplyBundleView bundle={result.bundle} />;
}

// ── Error states ──────────────────────────────────────────────────────────────

function BundleErrorView({ reason }: { reason: 'expired' | 'not_found' | 'error' }) {
  const messages = {
    expired: {
      emoji: '⏱',
      title: 'This bundle has expired',
      body: 'Credential bundles are valid for 24 hours. Ask the clinician to generate a new one.',
    },
    not_found: {
      emoji: '🔍',
      title: 'Bundle not found',
      body: 'This bundle link is invalid or has been revoked.',
    },
    error: {
      emoji: '⚠️',
      title: 'Connection Interrupted',
      body: 'We could not fetch this bundle right now. Please try again in a few minutes.',
    },
  };

  const msg = messages[reason];

  return (
    <div className="flex min-h-screen items-center justify-center bg-ops-gradient px-4 text-white">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="text-5xl">{msg.emoji}</div>
        <h1 className="text-xl font-bold text-white">{msg.title}</h1>
        <p className="text-sm text-white/40">{msg.body}</p>
        <a
          href="https://vitalcv.com"
          className="mt-4 inline-block rounded-xl border border-white/6 bg-[var(--vt-surface-dim)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/8"
        >
          Go to VitalCV
        </a>
      </div>
    </div>
  );
}
