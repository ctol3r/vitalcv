/**
 * /receipt/[receiptId] — Production Receipt Page
 *
 * Server Component. Public (no auth). Dynamic.
 *
 * 7 visual zones:
 *   1. Institutional Masthead (dark bg-gray-900)
 *   2. Ownership + Status Bar
 *   3. Replay Chain + 4. Issuer Continuity (side by side)
 *   5. Provenance Strip (full width)
 *   6. Download Actions
 *   7. Verification Instructions (collapsible)
 */

import { notFound } from 'next/navigation';
import { IssuerContinuityPanel } from '@/components/verifier/IssuerContinuityPanel';
import { TrustTierBadge, type TrustTier } from '@/components/proof/TrustTierBadge';
import { DownloadReceiptButton } from '@/components/receipt/DownloadReceiptButton';
import { getTrustRegisterSnapshot } from '@/lib/trust/register';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublicReceiptResponse {
  receipt_id: string;
  lane: string;
  source: string;
  checked_at: number;
  signed_payload: {
    algorithm: string;
    payload: string;
    signature?: string;
    signing_key_id?: string;
    signed_at?: number;
    expires_at?: number;
  } | null;
  key_fingerprint: string | null;
  issuer_did: string;
  jwks_uri: string;
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchReceipt(receiptId: string): Promise<PublicReceiptResponse | null> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.NODE_ENV === 'production'
        ? 'https://app.vitalcv.com'
        : 'http://localhost:3000');

    const res = await fetch(
      `${baseUrl}/api/receipt/${encodeURIComponent(receiptId)}`,
      {
        next: { revalidate: 60 },
      },
    );

    if (res.status === 404) return null;
    if (!res.ok) return null;

    return (await res.json()) as PublicReceiptResponse;
  } catch {
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveTier(receipt: PublicReceiptResponse): TrustTier {
  if (receipt.signed_payload?.signing_key_id) return 'T4';
  if (receipt.lane && receipt.checked_at) return 'T3';
  return 'T1';
}

function deriveSurvivabilityScore(receipt: PublicReceiptResponse): number {
  let score = 0;
  if (receipt.signed_payload) score += 40;
  if (receipt.key_fingerprint) score += 20;
  if (receipt.source) score += 20;
  if (receipt.lane) score += 10;
  if (receipt.checked_at) score += 10;
  return score;
}

function formatCheckedAt(ts: number): string {
  return new Date(ts).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function survivabilityColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-600';
}

// ─── Sub-components (server, no 'use client') ─────────────────────────────────

function ZoneMasthead({
  receiptId,
  tier,
  signingKeyId,
  runId,
  checkedAt,
  issuerDid,
}: {
  receiptId: string;
  tier: TrustTier;
  signingKeyId: string | null;
  runId: string;
  checkedAt: string;
  issuerDid: string;
}) {
  return (
    <div className="receipt-masthead bg-gray-900 text-white px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">
            VitalCV Trust Receipt
          </h1>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Institutional verification artifact — cryptographic plane
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <TrustTierBadge tier={tier} />
          <span className="font-mono text-[10px] text-gray-400 bg-gray-800 rounded px-2 py-1">
            {receiptId}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1.5 text-[11px]">
        <MastheadRow label="Issued by" value={issuerDid} mono />
        <MastheadRow
          label="Key"
          value={signingKeyId ?? '—'}
          mono
        />
        <MastheadRow label="Run" value={runId} mono />
        <MastheadRow label="Checked" value={checkedAt} />
      </div>
    </div>
  );
}

function MastheadRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-gray-500 w-16 flex-shrink-0">{label}:</span>
      <span className={mono ? 'font-mono text-gray-300 break-all' : 'text-gray-300'}>
        {value}
      </span>
    </div>
  );
}

function ZoneOwnershipStatus({
  actorId,
  tier,
  source,
  survivabilityScore,
}: {
  actorId: string;
  tier: TrustTier;
  source: string;
  survivabilityScore: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3 bg-gray-50 border-b border-gray-200 text-sm">
      <StatusItem label="Owner" value={actorId} />
      <StatusItem
        label="Status"
        value={
          <TrustTierBadge tier={tier} />
        }
      />
      <StatusItem label="Source" value={source || '—'} />
      <StatusItem
        label="Survivability"
        value={
          <span className={`font-semibold ${survivabilityColor(survivabilityScore)}`}>
            {survivabilityScore}/100
          </span>
        }
      />
    </div>
  );
}

function StatusItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
        {label}
      </span>
      <span className="text-gray-800">
        {typeof value === 'string' ? (
          <span className="text-sm text-gray-700">{value}</span>
        ) : (
          value
        )}
      </span>
    </div>
  );
}

function ZoneReplayChain({
  lane,
  source,
  checkedAt,
  receiptId,
  signingKeyId,
}: {
  lane: string;
  source: string;
  checkedAt: string;
  receiptId: string;
  signingKeyId: string | null;
}) {
  return (
    <div className="border border-gray-200 rounded overflow-hidden h-full">
      <div className="bg-gray-50 border-b border-gray-200 px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          Replay Chain
        </span>
      </div>
      <div className="divide-y divide-gray-100">
        <ReplayRow ts={checkedAt} lane={lane} status="verified" receiptId={shortId(receiptId)} />
        {signingKeyId && (
          <ReplayRow
            ts={checkedAt}
            lane="cryptographic_seal"
            status="signed"
            receiptId={signingKeyId.slice(-8)}
          />
        )}
      </div>
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
        <p className="text-[10px] text-gray-400">
          Source: <span className="font-mono">{source || lane}</span>
        </p>
      </div>
    </div>
  );
}

function ReplayRow({
  ts,
  lane,
  status,
  receiptId,
}: {
  ts: string;
  lane: string;
  status: string;
  receiptId: string;
}) {
  const statusColor =
    status === 'verified' || status === 'signed'
      ? 'text-green-600'
      : 'text-gray-500';

  return (
    <div className="flex items-center gap-3 px-3 py-2 text-xs">
      <span className="font-mono text-gray-400 text-[10px] w-36 flex-shrink-0">{ts}</span>
      <span className="text-gray-700 flex-1">{lane}</span>
      <span className={`font-semibold uppercase text-[10px] ${statusColor}`}>{status}</span>
      <span className="font-mono text-[10px] text-gray-400">{receiptId}</span>
    </div>
  );
}

function ZoneProvenanceStrip({
  receiptId,
  lane,
  source,
  checkedAt,
  issuerDid,
  signingKeyId,
  tier,
}: {
  receiptId: string;
  lane: string;
  source: string;
  checkedAt: string;
  issuerDid: string;
  signingKeyId: string | null;
  tier: TrustTier;
}) {
  const isSuccess = tier === 'T3' || tier === 'T4';

  return (
    <div
      className={[
        'rounded border px-4 py-3',
        isSuccess
          ? 'trust-register-success border-green-300 bg-green-50'
          : 'border-amber-200 bg-amber-50',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
            Provenance
          </p>
          {isSuccess && (
            <p className="text-sm font-semibold text-green-700 mb-1">
              ✓ No adverse findings — Source checked, no exclusions, revocations, or sanctions found
            </p>
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
            <span>
              Receipt: <span className="font-mono">{receiptId}</span>
            </span>
            <span>
              Lane: <span className="font-mono">{lane}</span>
            </span>
            <span>
              Source: <span className="font-mono">{source}</span>
            </span>
            <span>
              Issuer: <span className="font-mono">{issuerDid}</span>
            </span>
            {signingKeyId && (
              <span>
                Key: <span className="font-mono">{signingKeyId}</span>
              </span>
            )}
            <span>
              Checked: <span className="font-mono">{checkedAt}</span>
            </span>
          </div>
        </div>
        <TrustTierBadge tier={tier} />
      </div>
    </div>
  );
}

function ZoneVerificationInstructions({
  signingKeyId,
}: {
  signingKeyId: string | null;
}) {
  return (
    <details className="border border-gray-200 rounded overflow-hidden receipt-print-hide">
      <summary className="bg-gray-50 px-4 py-2.5 cursor-pointer text-sm font-semibold text-gray-700 hover:bg-gray-100 select-none">
        Offline Verification Instructions
      </summary>
      <div className="px-4 py-4 bg-white">
        <p className="text-xs text-gray-500 mb-3">
          To verify this receipt without VitalCV infrastructure:
        </p>
        <ol className="space-y-2 text-sm text-gray-700 list-none">
          {[
            <>
              Fetch the public key from{' '}
              <code className="font-mono text-xs bg-gray-100 px-1 rounded">
                https://vitalcv.com/.well-known/jwks.json
              </code>
            </>,
            <>
              Match the key where{' '}
              <code className="font-mono text-xs bg-gray-100 px-1 rounded">
                kid = &quot;{signingKeyId ?? '<signing_key_id>'}&quot;
              </code>
            </>,
            <>
              Verify the ES256 signature using the matched EC P-256 public key
            </>,
            <>
              Confirm{' '}
              <code className="font-mono text-xs bg-gray-100 px-1 rounded">
                iss = &quot;https://vitalcv.com&quot;
              </code>{' '}
              and{' '}
              <code className="font-mono text-xs bg-gray-100 px-1 rounded">exp</code>{' '}
              is in the future
            </>,
            <>
              Inspect{' '}
              <code className="font-mono text-xs bg-gray-100 px-1 rounded">vcv.actor_id</code>{' '}
              for issuance attribution
            </>,
            <>
              Inspect{' '}
              <code className="font-mono text-xs bg-gray-100 px-1 rounded">vcv.provider_id</code>{' '}
              for NPI binding
            </>,
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="font-mono text-[11px] font-bold text-gray-400 flex-shrink-0 w-4 pt-0.5">
                {i + 1}.
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ receiptId: string }>;
}) {
  const { receiptId } = await params;

  const [receipt, snapshot] = await Promise.all([
    fetchReceipt(receiptId),
    getTrustRegisterSnapshot(),
  ]);

  if (!receipt) {
    notFound();
  }

  const tier = deriveTier(receipt);
  const survivabilityScore = deriveSurvivabilityScore(receipt);
  const checkedAt = formatCheckedAt(receipt.checked_at);
  const signingKeyId =
    receipt.signed_payload?.signing_key_id ?? receipt.key_fingerprint ?? null;
  const runId = signingKeyId
    ? `run-${shortId(receipt.receipt_id)}`
    : `run-${receipt.receipt_id.slice(0, 12)}`;

  // VC 2.0 JSON for download
  const vcJson = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://vitalcv.com/contexts/v1',
    ],
    type: ['VerifiableCredential', 'VitalCVCredential'],
    issuer: 'did:web:vitalcv.com',
    issuanceDate: new Date(receipt.checked_at).toISOString(),
    credentialSubject: {
      id: `did:web:vitalcv.com/providers/receipt-${encodeURIComponent(receipt.receipt_id)}`,
      receiptId: receipt.receipt_id,
      source: receipt.source,
      lane: receipt.lane,
      status: 'verified',
      checkedAt: checkedAt,
    },
    proof: {
      type: 'ES256',
      kid: signingKeyId ?? snapshot.signingKeyId ?? 'unknown',
      jwksUri: '/.well-known/jwks.json',
    },
  };

  return (
    <>
      {/* Print-only: show all content */}
      <div className="receipt-print-only hidden">
        {/* This block is only visible when printing */}
      </div>

      <main className="min-h-screen bg-white">
        {/* ── ZONE 1: Institutional Masthead ─────────────────────────────── */}
        <ZoneMasthead
          receiptId={receipt.receipt_id}
          tier={tier}
          signingKeyId={signingKeyId}
          runId={runId}
          checkedAt={checkedAt}
          issuerDid={receipt.issuer_did ?? snapshot.issuerDid}
        />

        {/* ── ZONE 2: Ownership + Status Bar ─────────────────────────────── */}
        <ZoneOwnershipStatus
          actorId="System"
          tier={tier}
          source={receipt.source}
          survivabilityScore={survivabilityScore}
        />

        {/* ── ZONE 3 + 4: Replay Chain + Issuer Continuity ───────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-6 py-4">
          <ZoneReplayChain
            lane={receipt.lane}
            source={receipt.source}
            checkedAt={checkedAt}
            receiptId={receipt.receipt_id}
            signingKeyId={signingKeyId}
          />
          <IssuerContinuityPanel
            did={receipt.issuer_did ?? snapshot.issuerDid}
            signingKeyId={signingKeyId}
          />
        </div>

        {/* ── ZONE 5: Provenance Strip ────────────────────────────────────── */}
        <div className="px-6 pb-4">
          <ZoneProvenanceStrip
            receiptId={receipt.receipt_id}
            lane={receipt.lane}
            source={receipt.source}
            checkedAt={checkedAt}
            issuerDid={receipt.issuer_did ?? snapshot.issuerDid}
            signingKeyId={signingKeyId}
            tier={tier}
          />
        </div>

        {/* ── ZONE 6: Download Actions ─────────────────────────────────────── */}
        <div className="px-6 pb-4 flex flex-wrap gap-3 receipt-print-hide">
          <DownloadReceiptButton
            receiptId={receipt.receipt_id}
            vcJson={vcJson}
            label="Download VC 2.0 JSON"
            filename={`vcv-receipt-${receipt.receipt_id}.vc.json`}
          />
          <DownloadReceiptButton
            receiptId={receipt.receipt_id}
            label="Download Verifier PDF"
            printMode
          />
        </div>

        {/* ── ZONE 7: Verification Instructions ──────────────────────────── */}
        <div className="px-6 pb-8">
          <ZoneVerificationInstructions signingKeyId={signingKeyId} />
        </div>
      </main>
    </>
  );
}

export const dynamic = 'force-dynamic';
