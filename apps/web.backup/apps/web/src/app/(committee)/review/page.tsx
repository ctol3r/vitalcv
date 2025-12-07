'use client';

import { useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle, CheckCircle2, FileSignature, ShieldCheck } from 'lucide-react';

interface CommitteePacket {
  clinician: {
    name: string;
    specialty: string;
    npi: string;
  };
  privileges: Array<{
    code: string;
    name: string;
    status: 'recommended' | 'watch' | 'hold';
    coverage: number;
    site: string;
  }>;
  caseLogs: Array<{
    procedure: string;
    count: number;
    mostRecentCase: string;
    evidenceSource: string;
  }>;
  training: Array<{
    program: string;
    sponsor: string;
    completedAt: string;
    expiresAt: string;
  }>;
  riskSignals: Array<{
    id: string;
    label: string;
    severity: 'info' | 'warning' | 'critical';
    summary: string;
  }>;
  anchor: {
    merkleRoot: string;
    txHash: string;
    network: string;
  };
}

export default function CommitteeReviewPage() {
  const packet = useMemo(buildMockPacket, []);
  const [reviewNote, setReviewNote] = useState(
    'Clinical readiness verified. Committee recommends granting structural privileges with quarterly OPPE.',
  );
  const [signatureName, setSignatureName] = useState('Dr. Elaine Kwan');
  const [signingPin, setSigningPin] = useState('');
  const [signed, setSigned] = useState(false);
  const [autoPropagate, setAutoPropagate] = useState(true);
  const [notifyOps, setNotifyOps] = useState(true);

  function handleSign() {
    if (!signatureName || signingPin.length < 4) return;
    setSigned(true);
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Committee · Review packet</p>
        <h1 className="text-3xl font-bold">E-sign & anchor</h1>
        <p className="max-w-3xl text-muted-foreground">
          Review the curated privilege packet, confirm prerequisite evidence, and execute a tamper-evident signature
          that anchors the committee decision to the trust ledger.
        </p>
      </header>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>Clinician packet</CardTitle>
            <CardDescription>Highlights from the composite privilege dossier routed to this committee.</CardDescription>
          </div>
          <Badge variant="secondary">Packet #{packet.anchor.merkleRoot.slice(0, 8)}</Badge>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Clinician</p>
            <p className="text-xl font-semibold">{packet.clinician.name}</p>
            <p className="text-sm text-muted-foreground">{packet.clinician.specialty}</p>
            <p className="text-xs text-muted-foreground">NPI {packet.clinician.npi}</p>
          </div>
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Privileges routed</p>
            <div className="space-y-2">
              {packet.privileges.map((privilege) => (
                <div key={privilege.code} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold">{privilege.code}</p>
                    <p className="text-xs text-muted-foreground">{privilege.name}</p>
                  </div>
                  <Badge variant={privilege.status === 'recommended' ? 'default' : privilege.status === 'watch' ? 'secondary' : 'destructive'}>
                    {privilege.status === 'recommended'
                      ? 'Recommend'
                      : privilege.status === 'watch'
                        ? 'Watch'
                        : 'Hold'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Coverage</p>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt>Privilege alignment</dt>
                <dd className="font-semibold">
                  {Math.round(packet.privileges.reduce((sum, p) => sum + p.coverage, 0) / packet.privileges.length)}%
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Sites in scope</dt>
                <dd className="font-semibold">3</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Risk category</dt>
                <dd>
                  <Badge variant="outline" className="gap-1">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                    Green
                  </Badge>
                </dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Case log evidence</CardTitle>
            <CardDescription>Twelve-month TEFCA sourced procedure volume snapshots.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Procedure</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Most recent case</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packet.caseLogs.map((log) => (
                  <TableRow key={log.procedure}>
                    <TableCell className="font-medium">{log.procedure}</TableCell>
                    <TableCell>{log.count}</TableCell>
                    <TableCell>{new Date(log.mostRecentCase).toLocaleDateString()}</TableCell>
                    <TableCell>{log.evidenceSource}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Training evidence</CardTitle>
              <CardDescription>Auto-ingested credentialing pathways with expiration checks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {packet.training.map((training) => (
                <div key={training.program} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{training.program}</p>
                    <Badge variant="outline">{training.sponsor}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Completed {new Date(training.completedAt).toLocaleDateString()} · Expires{' '}
                    {new Date(training.expiresAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Risk signals</CardTitle>
              <CardDescription>Safety telemetry attached to this committee packet.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {packet.riskSignals.map((signal) => (
                <Alert
                  key={signal.id}
                  variant={signal.severity === 'critical' ? 'destructive' : signal.severity === 'warning' ? 'default' : 'default'}
                >
                  {signal.severity === 'critical' ? (
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  )}
                  <AlertTitle>{signal.label}</AlertTitle>
                  <AlertDescription>{signal.summary}</AlertDescription>
                </Alert>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Committee e-sign</CardTitle>
            <CardDescription>Attest to readiness, assign actions, and anchor to ledger.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Review note</p>
                <Textarea
                  value={reviewNote}
                  onChange={(event) => setReviewNote(event.target.value)}
                  className="mt-2 min-h-[120px]"
                />
              </div>
              <div className="space-y-4 rounded-lg border p-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Signature</p>
                  <Input
                    value={signatureName}
                    onChange={(event) => setSignatureName(event.target.value)}
                    className="mt-2"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">PIN</p>
                  <Input
                    value={signingPin}
                    onChange={(event) => setSigningPin(event.target.value)}
                    placeholder="4-digit code"
                    type="password"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ToggleRow
                label="Auto-propagate to aligned sites"
                description="Issue privileges downstream once anchor is confirmed."
                checked={autoPropagate}
                onCheckedChange={setAutoPropagate}
              />
              <ToggleRow
                label="Notify credentialing ops"
                description="Send anchored summary + delta metrics to ops room."
                checked={notifyOps}
                onCheckedChange={setNotifyOps}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleSign} disabled={signed || signingPin.length < 4}>
                <FileSignature className="mr-2 h-4 w-4" aria-hidden="true" />
                {signed ? 'Signature captured' : 'Approve & anchor'}
              </Button>
              <Button variant="outline">Return to revisions</Button>
              {signed && (
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Anchored to {packet.anchor.network}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Anchor preview</CardTitle>
            <CardDescription>Merkle root + tx hash prepared for notarization.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm font-mono">
            <div>
              <p className="text-xs text-muted-foreground">Merkle root</p>
              <p className="truncate">{packet.anchor.merkleRoot}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tx hash</p>
              <p className="truncate">{packet.anchor.txHash}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Network</p>
              <p>{packet.anchor.network}</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div>
        <p className="font-semibold text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function buildMockPacket(): CommitteePacket {
  return {
    clinician: {
      name: 'Dr. Asha Malik',
      specialty: 'Structural Cardiology',
      npi: '1689845521',
    },
    privileges: [
      { code: 'STRUCT-410', name: 'Structural Heart Interventions', status: 'recommended', coverage: 98, site: 'NYC-001' },
      { code: 'ROBOT-500', name: 'Robotic PCI', status: 'watch', coverage: 84, site: 'PA-003' },
      { code: 'HYBRID-720', name: 'Hybrid Suite Lead', status: 'hold', coverage: 66, site: 'PA-003' },
    ],
    caseLogs: [
      {
        procedure: 'TAVR',
        count: 62,
        mostRecentCase: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        evidenceSource: 'TEFCA employment VC',
      },
      {
        procedure: 'Left Atrial Appendage Closure',
        count: 34,
        mostRecentCase: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        evidenceSource: 'Self-reported log (verified)',
      },
      {
        procedure: 'Robotic PCI',
        count: 28,
        mostRecentCase: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        evidenceSource: 'Vendor proctor attestations',
      },
    ],
    training: [
      {
        program: 'Structural Heart Fellowship',
        sponsor: 'Cleveland Clinic',
        completedAt: '2018-06-01',
        expiresAt: '2026-06-01',
      },
      {
        program: 'Vendor Robotic Console',
        sponsor: 'Corindus',
        completedAt: '2024-02-15',
        expiresAt: '2025-02-15',
      },
    ],
    riskSignals: [
      {
        id: 'signal-1',
        label: 'OPPE trending high',
        severity: 'warning',
        summary: 'Door-to-balloon KPI exceeded peer median for two consecutive quarters. Tracked for remediation.',
      },
      {
        id: 'signal-2',
        label: 'Radiation badge audit clean',
        severity: 'info',
        summary: 'Last audit completed with no variance. Physics documentation included in packet.',
      },
    ],
    anchor: {
      merkleRoot: '0x5fa49a839f2b745cb0dd8d8ccd960f4fd2b93c1a4e8932b3af8148c42a4209b1',
      txHash: '0x1cc3ed09732ec87b27bf0f0e1eabd785d9bd882a704fbc0a98ba673c1c67b128',
      network: 'pilot-l2',
    },
  };
}










