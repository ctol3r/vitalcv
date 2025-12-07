'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type DisclosureGroup = {
  id: string;
  label: string;
  description: string;
  required?: boolean;
  claims: { path: string; label: string }[];
};

const GROUPS: DisclosureGroup[] = [
  {
    id: 'identity-core',
    label: 'Identity basics',
    description: 'Full name & NPI for matching',
    required: true,
    claims: [
      { path: 'credentialSubject.name', label: 'Full name' },
      { path: 'credentialSubject.npi', label: 'NPI' },
    ],
  },
  {
    id: 'identity-specialty',
    label: 'Specialty',
    description: 'Clinical specialty shared with payer',
    claims: [{ path: 'credentialSubject.specialty', label: 'Specialty' }],
  },
  {
    id: 'license-status',
    label: 'License status',
    description: 'State, license #, and expiration',
    claims: [
      { path: 'credentialSubject.license.state', label: 'State' },
      { path: 'credentialSubject.license.number', label: 'License number' },
      { path: 'credentialSubject.license.expiresOn', label: 'Expires on' },
    ],
  },
];

const CREDENTIAL = {
  id: 'https://issuer.vitalcv.com/credentials/demo-123',
  '@context': ['https://www.w3.org/2018/credentials/v1'],
  type: ['VerifiableCredential', 'ClinicianIdentityCredential', 'LicenseVC'],
  issuer: 'did:web:issuer.vitalcv.com',
  issuanceDate: '2025-10-25T13:00:00.000Z',
  expirationDate: '2026-10-25T13:00:00.000Z',
  credentialSubject: {
    id: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
    name: 'Dr. Jane Smith',
    npi: '1234567890',
    specialty: 'Cardiology',
    license: {
      number: 'A12345',
      state: 'CA',
      expiresOn: '2026-04-01',
    },
  },
};

const SAMPLE_JKT = 'thumbprint-demo-9f83';
const SAMPLE_NONCE = 'nonce-2f1c';

export default function ClinicianWalletDisclosePage() {
  const [selectedGroups, setSelectedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    GROUPS.forEach((group) => {
      initial[group.id] = Boolean(group.required);
    });
    return initial;
  });

  const { revealedClaims, hiddenClaims } = useMemo(() => {
    const revealed: { label: string; value: string; path: string }[] = [];
    const hidden: { label: string; path: string }[] = [];

    GROUPS.forEach((group) => {
      group.claims.forEach((claim) => {
        const value = getClaimValue(CREDENTIAL, claim.path);
        if (selectedGroups[group.id]) {
          revealed.push({ path: claim.path, label: claim.label, value: value ?? '—' });
        } else {
          hidden.push({ path: claim.path, label: claim.label });
        }
      });
    });

    return { revealedClaims: revealed, hiddenClaims: hidden };
  }, [selectedGroups]);

  const nonceBinding = useMemo(() => encodeBase64Url(`${SAMPLE_NONCE}.${SAMPLE_JKT}`), []);

  const activeGroupCount = Object.values(selectedGroups).filter(Boolean).length;

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <Badge variant="secondary" className="uppercase">
          Demo Wallet
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Selective Disclosure Preview</h1>
        <p className="text-muted-foreground">
          Pick which disclosure groups to reveal when presenting this credential. Toggle groups to
          see exactly what the verifier receives.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Credential snapshot</CardTitle>
              <CardDescription>
                Only the selected groups are sent to the verifier — everything else stays redacted.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                <p className="font-medium">Credential metadata</p>
                <p>ID: <span className="font-mono text-xs">{CREDENTIAL.id}</span></p>
                <p>Issued: {new Date(CREDENTIAL.issuanceDate).toLocaleString()}</p>
                <p>Expires: {new Date(CREDENTIAL.expirationDate).toLocaleString()}</p>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Claim</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {GROUPS.flatMap((group) =>
                    group.claims.map((claim) => {
                      const value = getClaimValue(CREDENTIAL, claim.path);
                      const revealed = selectedGroups[group.id];
                      return (
                        <TableRow key={claim.path}>
                          <TableCell className="font-medium">
                            {claim.label}{' '}
                            {group.required && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                required
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {revealed ? (
                              <span>{value ?? '—'}</span>
                            ) : (
                              <span className="text-muted-foreground">Hidden</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    }),
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Presentation payload</CardTitle>
              <CardDescription>
                Minimal JSON body that will be signed with a DPoP-bound nonce.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <pre className="rounded-lg bg-muted p-4 text-xs leading-relaxed text-muted-foreground">
{JSON.stringify(
  {
    csdJwt: 'csd.jwt.compact-demo…',
    revealGroups: Object.entries(selectedGroups)
      .filter(([, value]) => value)
      .map(([id]) => id),
    disclosures: revealedClaims.map((claim) => ({
      path: claim.path,
      value: claim.value,
    })),
    proof: {
      nonce: SAMPLE_NONCE,
      binding: nonceBinding,
      dpop: {
        proof: 'dpop.jwt.demo…',
        jkt: SAMPLE_JKT,
      },
    },
  },
  null,
  2,
)}
              </pre>
              <p className="text-sm text-muted-foreground">
                The nonce binding ties this presentation to the DPoP key thumbprint (
                <span className="font-mono text-xs">{SAMPLE_JKT}</span>) so the verifier can reject
                replays.
              </p>
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Disclosure groups</CardTitle>
              <CardDescription>Toggle each group to decide what gets revealed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {GROUPS.map((group) => (
                <div
                  key={group.id}
                  className="flex items-start justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{group.label}</p>
                    <p className="text-sm text-muted-foreground">{group.description}</p>
                  </div>
                  <Checkbox
                    checked={selectedGroups[group.id]}
                    disabled={group.required}
                    onCheckedChange={(checked) =>
                      setSelectedGroups((prev) => ({
                        ...prev,
                        [group.id]: Boolean(checked),
                      }))
                    }
                    aria-label={`Reveal ${group.label}`}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>What the verifier will see.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Revealed groups</span>
                <Badge variant="outline">{activeGroupCount}</Badge>
              </div>
              <div>
                <p className="font-medium">Claims shared</p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {revealedClaims.map((claim) => (
                    <li key={claim.path}>
                      {claim.label}: <span className="text-foreground">{claim.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {hiddenClaims.length > 0 && (
                <div>
                  <p className="font-medium">Still hidden</p>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {hiddenClaims.map((claim) => (
                      <li key={claim.path}>{claim.label}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Button className="w-full" disabled={activeGroupCount === 0}>
                Send to verifier
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function getClaimValue(source: any, path: string): string | undefined {
  return path.split('.').reduce<any>((acc, segment) => acc?.[segment], source);
}

function encodeBase64Url(value: string): string {
  const base64 =
    typeof window === 'undefined'
      ? Buffer.from(value, 'utf-8').toString('base64')
      : window.btoa(value);
  return base64.replace(/=+$/, '');
}


