import { notFound } from 'next/navigation';

interface AuditPageProps {
  params: { id: string };
}

interface VerificationExportPayload {
  presentationId: string;
  generatedAt: string;
  verificationSummary: {
    status: 'valid' | 'invalid' | 'revoked';
    valid: boolean;
    credentialType?: string;
    holder?: { subject?: string };
  };
  issuerMetadata: {
    did: string;
    name?: string;
    thumbprint?: string;
    jwksUri?: string;
    kid?: string;
  };
  timestamps: {
    verifiedAt: string;
    expiresAt?: string;
  };
  auditAnchors: {
    status: string;
    network: string;
    txHash: string;
    blockHash: string;
    blockNumber: number;
    anchorId: string;
    timestamp: string;
  };
  revocation: {
    revoked: boolean;
    statusListUrl?: string;
    statusListIndex?: string;
    checkedAt: string;
    reason?: string;
  };
  raw: {
    payload: Record<string, any>;
  };
}

export default async function VerifierAuditPage({ params }: AuditPageProps) {
  const record = await fetchAuditRecord(params.id);
  if (!record) {
    notFound();
  }

  const timeline = buildTimeline(record);
  const technicalProof = extractTechnicalProof(record);

  return (
    <div className="space-y-8 p-6 lg:p-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">Verifier audit</p>
        <h1 className="text-3xl font-semibold tracking-tight">Presentation #{record.presentationId}</h1>
        <p className="text-sm text-muted-foreground">
          Generated {formatDate(record.generatedAt)} • Issuer {record.issuerMetadata.did}
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-xl border bg-card p-6 shadow-sm lg:col-span-3">
          <h2 className="text-lg font-semibold">Verification timeline</h2>
          <ol className="mt-4 space-y-4">
            {timeline.map((step) => (
              <li key={step.label} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span
                    className={`h-3 w-3 rounded-full border ${step.active ? 'bg-emerald-500 border-emerald-600' : 'bg-muted'}`}
                  />
                  <span className="flex-1 border-l border-dashed border-muted-foreground/40" />
                </div>
                <div>
                  <p className="text-sm font-medium">{step.label}</p>
                  <p className="text-xs text-muted-foreground">{step.caption}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">StatusList bit</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">State</dt>
                <dd className={`font-medium ${record.revocation.revoked ? 'text-red-600' : 'text-emerald-600'}`}>
                  {record.revocation.revoked ? 'Revoked' : 'Valid'}
                </dd>
              </div>
              {record.revocation.statusListIndex && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Bit index</dt>
                  <dd>{record.revocation.statusListIndex}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Checked</dt>
                <dd>{formatDate(record.revocation.checkedAt)}</dd>
              </div>
              {record.revocation.statusListUrl && (
                <div className="flex flex-col">
                  <dt className="text-muted-foreground">Status list</dt>
                  <dd className="truncate text-xs">{record.revocation.statusListUrl}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Issuer metadata</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">DID</dt>
                <dd className="truncate text-xs">{record.issuerMetadata.did}</dd>
              </div>
              {record.issuerMetadata.name && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Display name</dt>
                  <dd>{record.issuerMetadata.name}</dd>
                </div>
              )}
              {record.issuerMetadata.thumbprint && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Thumbprint</dt>
                  <dd className="text-xs">{record.issuerMetadata.thumbprint}</dd>
                </div>
              )}
              {record.issuerMetadata.jwksUri && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">JWKS</dt>
                  <dd className="truncate text-xs">{record.issuerMetadata.jwksUri}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Chain anchors</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Network</dt>
              <dd>{record.auditAnchors.network}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tx hash</dt>
              <dd className="truncate text-xs">{record.auditAnchors.txHash}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Block</dt>
              <dd>{record.auditAnchors.blockNumber}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Anchored</dt>
              <dd>{formatDate(record.auditAnchors.timestamp)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Technical proof</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Status</dt>
              <dd className={`font-medium ${record.verificationSummary.valid ? 'text-emerald-600' : 'text-red-600'}`}>
                {record.verificationSummary.status}
              </dd>
            </div>
            {technicalProof.format && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Proof type</dt>
                <dd>{technicalProof.format}</dd>
              </div>
            )}
            {technicalProof.reason && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Reason</dt>
                <dd>{technicalProof.reason}</dd>
              </div>
            )}
            <div className="flex flex-col">
              <dt className="text-muted-foreground">Subject</dt>
              <dd>{record.verificationSummary.holder?.subject ?? 'Unknown'}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}

async function fetchAuditRecord(id: string): Promise<VerificationExportPayload | null> {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
    const response = await fetch(`${backendUrl}/api/verify/export/${id}`, {
      next: { revalidate: 30 },
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as VerificationExportPayload;
  } catch {
    return null;
  }
}

function buildTimeline(record: VerificationExportPayload) {
  return [
    {
      label: 'Verified',
      caption: formatDate(record.timestamps.verifiedAt),
      active: true,
    },
    {
      label: 'Anchored on chain',
      caption: formatDate(record.auditAnchors.timestamp),
      active: true,
    },
    {
      label: 'StatusList polled',
      caption: formatDate(record.revocation.checkedAt),
      active: !record.revocation.revoked,
    },
  ];
}

function extractTechnicalProof(record: VerificationExportPayload) {
  const format =
    record.raw?.payload?.__proofs?.[0]?.proofType ?? record.verificationSummary.credentialType;
  const reason = record.raw?.payload?.__proofs?.[0]?.reason ?? record.revocation.reason;
  return { format, reason };
}

function formatDate(value?: string | number) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}











