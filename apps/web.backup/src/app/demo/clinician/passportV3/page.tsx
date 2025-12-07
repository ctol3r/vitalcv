'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Layers,
  ListChecks,
  Lock,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import SharePanel from '@/components/passportV3/SharePanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const FALLBACK_CLINICIAN_ID = 'clinician-demo-001';

const selectiveDisclosureFields = [
  {
    id: 'identity',
    label: 'Identity',
    description: 'Full name + hashed NPI',
    defaultOn: true,
  },
  {
    id: 'licenses',
    label: 'Licenses',
    description: 'State licenses + compacts',
    defaultOn: true,
  },
  {
    id: 'privileges',
    label: 'Privileges',
    description: 'Facility + service line',
    defaultOn: false,
  },
  {
    id: 'dea',
    label: 'DEA schedules',
    description: 'DEA number + schedules',
    defaultOn: false,
  },
  {
    id: 'contact',
    label: 'Contact',
    description: 'Work email + on-call channel',
    defaultOn: false,
  },
];

const passportSections = [
  {
    title: 'Identity & Licensure',
    icon: ShieldCheck,
    description: 'Bound DID + current licenses anchored at Vital Network.',
    evidenceTag: 'Vital Graph anchor',
    claims: [
      { label: 'Full name', value: 'Dr. Ava Coleman', sdField: 'identity' },
      { label: 'NPI / hash', value: '1992132440 · 0x7c91…', sdField: 'identity' },
      { label: 'Compact eligibility', value: 'IMLC active – 13 states', sdField: 'licenses' },
      { label: 'Primary state license', value: 'WA MD #MD60520122 (expires 2027-04-14)', sdField: 'licenses' },
      { label: 'Board certification', value: 'ABEM · recert 2024-09-01', sdField: 'licenses' },
    ],
  },
  {
    title: 'Practice & Privileges',
    icon: Layers,
    description: 'Service-line privileges shared from Org A.',
    evidenceTag: 'Org A signature (ed25519)',
    claims: [
      { label: 'Facility', value: 'Org A • Cascadia Medical Center', sdField: 'privileges' },
      { label: 'Service lines', value: 'Emergency medicine, Telehealth ED', sdField: 'privileges' },
      { label: 'Privilege scope', value: 'Independent – no proctoring', sdField: 'privileges' },
      { label: 'Privilege renewal', value: 'Next committee review: 2026 Q1', sdField: 'privileges' },
    ],
  },
  {
    title: 'Regulatory controls',
    icon: Lock,
    description: 'DEA schedules + sanction sweep attestations.',
    evidenceTag: 'NCI proof bundle',
    claims: [
      { label: 'DEA number', value: 'FC7436817', sdField: 'dea' },
      { label: 'Controlled schedules', value: 'II — V (no waivers outstanding)', sdField: 'dea' },
      { label: 'Sanction sweeps', value: 'NPDB, OIG, SAM, OFAC — clean (Nov 2025)', sdField: 'dea' },
      { label: 'Contact for alerts', value: 'credentialing@northstar.org', sdField: 'contact' },
    ],
  },
];

const nciProofs = [
  {
    id: 'proof-npi',
    type: 'NPI identity binding',
    anchor: 'Vital NCI cluster us-west-2',
    status: 'verified',
    updated: 'Nov 10, 2025 · 02:33 PT',
  },
  {
    id: 'proof-privileges',
    type: 'Privilege issuance (Org A)',
    anchor: 'NCI trust chain /orgA/signing',
    status: 'verified',
    updated: 'Nov 09, 2025 · 17:12 PT',
  },
  {
    id: 'proof-risk',
    type: 'Risk signal delta',
    anchor: 'MobilityEngine-signal',
    status: 'info',
    updated: 'Nov 08, 2025 · 09:04 PT',
  },
];

function buildInitialSdState() {
  return selectiveDisclosureFields.reduce<Record<string, boolean>>((acc, field) => {
    acc[field.id] = field.defaultOn;
    return acc;
  }, {});
}

export default function ClinicianPassportV3Page({
  searchParams,
}: {
  searchParams?: { clinicianId?: string };
}) {
  const clinicianId = searchParams?.clinicianId ?? FALLBACK_CLINICIAN_ID;
  const [sdState, setSdState] = useState<Record<string, boolean>>(() => buildInitialSdState());

  const visibleClaimsCount = useMemo(
    () =>
      passportSections.reduce((total, section) => {
        return (
          total +
          section.claims.filter((claim) => sdState[claim.sdField ?? 'identity']).length
        );
      }, 0),
    [sdState],
  );

  const handleToggle = (fieldId: string) => {
    setSdState((prev) => ({ ...prev, [fieldId]: !prev[fieldId] }));
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline" className="gap-1">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Passport v3 demo
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <UsersRound className="h-3.5 w-3.5" aria-hidden="true" />
            Org A → Org B sharing
          </Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Clinician passport v3</h1>
        <p className="text-muted-foreground">
          Structured, selective disclosure passport for{' '}
          <span className="font-mono">{clinicianId}</span>. Toggle what Org B can see before
          federating via the NCI rail. All controls are keyboard and screen-reader friendly.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          <Card aria-label="Selective disclosure toggles">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5" aria-hidden="true" />
                Selective disclosure
              </CardTitle>
              <CardDescription>
                Decide which sections of the passport show up in the shared payload.{' '}
                <span className="font-medium text-foreground">{visibleClaimsCount}</span> claims
                currently visible.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectiveDisclosureFields.map((field) => {
                const enabled = sdState[field.id];
                return (
                  <Button
                    key={field.id}
                    variant={enabled ? 'default' : 'outline'}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => handleToggle(field.id)}
                  >
                    <span>
                      <span className="block text-sm font-medium">{field.label}</span>
                      <span className="text-xs text-muted-foreground">{field.description}</span>
                    </span>
                    <Badge variant={enabled ? 'outline' : 'secondary'} className="gap-1">
                      {enabled ? (
                        <>
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          Visible
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                          Hidden
                        </>
                      )}
                    </Badge>
                  </Button>
                );
              })}
            </CardContent>
          </Card>

          {passportSections.map((section) => (
            <Card key={section.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <section.icon className="h-5 w-5" aria-hidden="true" />
                  {section.title}
                </CardTitle>
                <CardDescription>{section.description}</CardDescription>
                <Badge variant="outline" className="w-fit text-xs">
                  {section.evidenceTag}
                </Badge>
              </CardHeader>
              <CardContent>
                <dl className="divide-y">
                  {section.claims.map((claim) => {
                    const visible = sdState[claim.sdField ?? 'identity'];
                    return (
                      <div
                        key={claim.label}
                        className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <dt className="text-sm font-medium text-muted-foreground">{claim.label}</dt>
                        <dd
                          className="text-sm font-semibold text-foreground"
                          aria-live="polite"
                          aria-label={`${claim.label} ${visible ? 'disclosed' : 'hidden'}`}
                        >
                          {visible ? (
                            claim.value
                          ) : (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                              Hidden until shared
                            </span>
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <SharePanel clinicianId={clinicianId} shortLink="https://vital.passport/ava" />

          <Card aria-label="NCI proof list">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                NCI proof bundle
              </CardTitle>
              <CardDescription>
                Selective disclosure proofs anchored at the National Credentialing Infrastructure.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {nciProofs.map((proof) => (
                  <li key={proof.id}>
                    <div className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
                      <div className="pt-0.5">
                        {proof.status === 'verified' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{proof.type}</p>
                        <p className="text-xs text-muted-foreground">{proof.anchor}</p>
                        <p className="text-xs text-muted-foreground">{proof.updated}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Proof metadata includes trust anchors plus selective disclosure commitments so Org B can
                replay the verification transcript.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Accessibility status
              </CardTitle>
              <CardDescription>Optimized for screen readers and high contrast.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Every toggle exposes <code>role="switch"</code> semantics and every field
                announces whether it&apos;s disclosed. Proof updates stream through ARIA live regions
                so assistive tech picks up changes instantly.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
