'use client';

import { Buffer } from 'buffer';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type ClaimOption = {
  path: string;
  label: string;
  helper?: string;
  required?: boolean;
};

type Credential = {
  id: string;
  issuer: string;
  issuanceDate: string;
  expirationDate: string;
  credentialSubject: Record<string, unknown>;
};

type ProofPreview = {
  token: string;
  disclosures: Array<{ path: string; value: unknown }>;
  shareUrl: string;
};

const CLAIM_OPTIONS: ClaimOption[] = [
  {
    path: 'credentialSubject.name',
    label: 'Full name',
    helper: 'Used for subject matching',
    required: true,
  },
  {
    path: 'credentialSubject.npi',
    label: 'NPI',
    helper: 'Required by payers',
    required: true,
  },
  {
    path: 'credentialSubject.stateLicense.state',
    label: 'License state',
  },
  {
    path: 'credentialSubject.stateLicense.number',
    label: 'License number',
  },
  {
    path: 'credentialSubject.stateLicense.expiresOn',
    label: 'License expiry',
  },
  {
    path: 'credentialSubject.board.specialty',
    label: 'Board specialty',
  },
  {
    path: 'credentialSubject.board.status',
    label: 'Board status',
  },
];

const FALLBACK_CREDENTIAL: Credential = {
  id: 'https://issuer.vitalcv.com/credentials/demo-wallet-001',
  issuer: 'did:web:issuer.vitalcv.com',
  issuanceDate: '2025-10-12T15:30:00.000Z',
  expirationDate: '2026-10-12T15:30:00.000Z',
  credentialSubject: {
    id: 'did:key:z6MkqdDemoWalletSubject',
    name: 'Dr. Elise Carter',
    npi: '1457382910',
    stateLicense: {
      number: 'CA-328710',
      state: 'CA',
      expiresOn: '2026-04-01',
    },
    board: {
      specialty: 'Cardiology',
      status: 'Active',
    },
  },
};

export default function ShareCredentialPage({ params }: { params: { id: string } }) {
  const [selectedClaims, setSelectedClaims] = useState<Record<string, boolean>>(() =>
    CLAIM_OPTIONS.reduce<Record<string, boolean>>((acc, claim) => {
      acc[claim.path] = Boolean(claim.required);
      return acc;
    }, {}),
  );
  const [proofPreview, setProofPreview] = useState<ProofPreview | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'token' | 'disclosures' | 'share' | null>(null);

  const credential = useMemo(() => loadCredential(params.id), [params.id]);

  const visibleClaims = useMemo(
    () => CLAIM_OPTIONS.filter((claim) => selectedClaims[claim.path]),
    [selectedClaims],
  );
  const hiddenClaims = useMemo(
    () => CLAIM_OPTIONS.filter((claim) => !selectedClaims[claim.path]),
    [selectedClaims],
  );

  async function handleGenerateProof() {
    if (visibleClaims.length === 0) {
      setError('Select at least one claim to disclose.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setCopiedField(null);

    try {
      const disclosures = visibleClaims.map((claim) => ({
        path: claim.path,
        value: lookupClaimValue(credential, claim.path),
      }));

      const token = buildStubSdJwtToken(credential.id, disclosures);
      const shareUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/verify/sd-jwt?token=${encodeURIComponent(token)}`
          : token;

      setProofPreview({
        token,
        disclosures,
        shareUrl,
      });
    } catch (err) {
      console.error('[wallet][sdjwt][generate]', err);
      setError('Unable to build SD-JWT preview. Please retry.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyToClipboard(value: string, field: typeof copiedField) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 2000);
    } catch (err) {
      console.warn('[wallet][sdjwt][copy]', err);
      setError('Clipboard copy failed. Copy manually instead.');
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header>
        <Badge variant="secondary">Wallet</Badge>
        <h1 className="mt-2 text-3xl font-semibold leading-tight">Selective disclosure</h1>
        <p className="text-muted-foreground">
          Choose which fields from credential <span className="font-mono text-xs">{params.id}</span>{' '}
          to reveal before generating an SD-JWT proof payload.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Claims to disclose</CardTitle>
            <CardDescription>Toggle the claims you plan to reveal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {CLAIM_OPTIONS.map((claim) => (
              <label
                key={claim.path}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/40"
              >
                <Checkbox
                  checked={selectedClaims[claim.path]}
                  disabled={claim.required}
                  onCheckedChange={(checked) =>
                    setSelectedClaims((prev) => ({
                      ...prev,
                      [claim.path]: Boolean(checked),
                    }))
                  }
                />
                <div className="text-sm">
                  <p className="font-medium">
                    {claim.label}{' '}
                    {claim.required && (
                      <Badge variant="outline" className="ml-2 uppercase">
                        required
                      </Badge>
                    )}
                  </p>
                  <p className="text-muted-foreground">{claim.helper ?? claim.path}</p>
                </div>
              </label>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Preview disclosed fields</CardTitle>
              <CardDescription>Only the selected rows below are shared.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {visibleClaims.length === 0 ? (
                <p className="text-sm text-muted-foreground">No claims selected.</p>
              ) : (
                <dl className="grid gap-3 text-sm">
                  {visibleClaims.map((claim) => (
                    <div
                      key={claim.path}
                      className="rounded-lg border px-3 py-2"
                    >
                      <dt className="font-medium">{claim.label}</dt>
                      <dd className="text-muted-foreground">
                        {formatClaimValue(lookupClaimValue(credential, claim.path))}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              {hiddenClaims.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Hidden:{' '}
                  {hiddenClaims
                    .map((claim) => claim.label)
                    .join(', ')}
                </div>
              )}

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button className="w-full" onClick={handleGenerateProof} disabled={isGenerating}>
                {isGenerating ? 'Generating…' : 'Generate SD-JWT Proof'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Proof payload</CardTitle>
              <CardDescription>
                Share the SD-JWT token together with the disclosures preview.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {proofPreview ? (
                <>
                  <div className="space-y-2">
                    <Label>SD-JWT token</Label>
                    <Textarea
                      readOnly
                      value={proofPreview.token}
                      className="font-mono text-xs"
                      rows={3}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(proofPreview.token, 'token')}
                    >
                      {copiedField === 'token' ? 'Copied' : 'Copy token'}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Disclosures JSON</Label>
                    <Textarea
                      readOnly
                      value={JSON.stringify(proofPreview.disclosures, null, 2)}
                      className="font-mono text-xs"
                      rows={6}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(JSON.stringify(proofPreview.disclosures, null, 2), 'disclosures')
                      }
                    >
                      {copiedField === 'disclosures' ? 'Copied' : 'Copy disclosures'}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Share link</Label>
                    <Textarea readOnly value={proofPreview.shareUrl} rows={2} />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(proofPreview.shareUrl, 'share')}
                    >
                      {copiedField === 'share' ? 'Copied' : 'Copy link'}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Generate a proof to see the SD-JWT token and disclosure bundle.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function loadCredential(id: string): Credential {
  return {
    ...FALLBACK_CREDENTIAL,
    id,
  };
}

function lookupClaimValue(source: Credential, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, segment) => {
    if (acc === undefined || acc === null) {
      return undefined;
    }
    if (segment.endsWith(']')) {
      const [prop, indexPart] = segment.split('[');
      const index = Number(indexPart.replace(']', ''));
      const target = (acc as Record<string, unknown>)[prop] as unknown[];
      return target?.[index];
    }
    return (acc as Record<string, unknown>)[segment];
  }, source);
}

function buildStubSdJwtToken(
  credentialId: string,
  disclosures: Array<{ path: string; value: unknown }>,
): string {
  const header = base64UrlEncode({
    alg: 'EdDSA',
    typ: 'vc+sd-jwt',
    kid: `${credentialId}#demo`,
  });

  const payload = base64UrlEncode({
    iss: FALLBACK_CREDENTIAL.issuer,
    sub: FALLBACK_CREDENTIAL.credentialSubject.id,
    disclosures: disclosures.map((entry) => entry.path),
    iat: Math.floor(Date.now() / 1000),
  });

  const signature = base64UrlEncode({
    fake: true,
    credentialId,
  });

  return `${header}.${payload}.${signature}`;
}

function formatClaimValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '—';
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function base64UrlEncode(input: Record<string, unknown>): string {
  const json = JSON.stringify(input);
  const base64 =
    typeof window !== 'undefined' && typeof window.btoa === 'function'
      ? window.btoa(json)
      : Buffer.from(json, 'utf-8').toString('base64');

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}



