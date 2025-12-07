'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, ShieldCheck, ShieldAlert, FileDown, Link, CheckCircle2 } from 'lucide-react';

interface EvidenceSummary {
  [category: string]: {
    count: number;
    latestAt: string;
  };
}

interface AnchorRecord {
  id: string;
  type: string;
  txHash: string;
  payload: { timestamp: string; [key: string]: any };
  network?: string;
}

interface FileCompletePayload {
  clinicianId: string;
  ready: boolean;
  missingCategories: string[];
  staleCategories: string[];
  evidenceSummary: EvidenceSummary;
  anchors: AnchorRecord[];
  packetArtifacts?: {
    json: string;
    pdfBase64: string;
    pdfFileName: string;
  } | null;
}

export default function AuditorClinicianPage() {
  const params = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<FileCompletePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        const response = await fetch(`/api/compliance/file-complete/${params.id}`, {
          method: 'POST',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const data = (await response.json()) as FileCompletePayload;
        setPayload(data);
      } catch (err) {
        console.warn('[audit portal] falling back to mock data', err);
        setError('Live compliance API unavailable. Showing cached mock data.');
        setPayload(buildMockPayload(params.id));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => controller.abort();
  }, [params.id]);

  const lifecycle = useMemo(() => {
    if (!payload?.packetArtifacts?.json) return [];
    try {
      const parsed = JSON.parse(payload.packetArtifacts.json);
      return parsed.credentialLifecycle ?? [];
    } catch {
      return [];
    }
  }, [payload]);

  const evidenceCards = useMemo(() => {
    const categories = ['CR1', 'CR2', 'CR3', 'CR4', 'CR5'];
    return categories.map((category) => {
      const summary = payload?.evidenceSummary?.[category];
      const missing = payload?.missingCategories.includes(category);
      const stale = payload?.staleCategories.includes(category);
      const status = missing ? 'missing' : stale ? 'stale' : summary ? 'complete' : 'missing';
      return {
        category,
        status,
        count: summary?.count ?? 0,
        latestAt: summary?.latestAt,
      };
    });
  }, [payload]);

  const anchors = payload?.anchors ?? [];

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="container mx-auto px-6 py-10">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>No data</AlertTitle>
          <AlertDescription>Unable to load audit packet.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-6 py-10 space-y-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Audit • NCQA readiness</p>
        <h1 className="text-3xl font-semibold tracking-tight">Clinician audit view</h1>
        <p className="text-muted-foreground">
          CR1–CR5 evidence completeness, anchors, history, and chain proofs for #{payload.clinicianId}.
        </p>
      </header>

      {error && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Offline mode</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Evidence completeness</CardTitle>
            <CardDescription>NCQA CR1–CR5 controls.</CardDescription>
          </div>
          <Badge variant={payload.ready ? 'default' : 'destructive'}>
            {payload.ready ? 'File complete' : 'Needs attention'}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-5">
          {evidenceCards.map((card) => (
            <div key={card.category} className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">{card.category}</p>
              <p className="text-2xl font-semibold mt-1">{card.count}</p>
              <Badge
                variant={
                  card.status === 'complete'
                    ? 'default'
                    : card.status === 'stale'
                    ? 'secondary'
                    : 'destructive'
                }
              >
                {card.status}
              </Badge>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {card.latestAt ? new Date(card.latestAt).toLocaleDateString() : 'No data'}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Audit anchors</CardTitle>
            <CardDescription>Chain proofs for collected evidence.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {anchors.length === 0 ? (
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>No anchors yet</AlertTitle>
                <AlertDescription>Collect evidence to anchor events.</AlertDescription>
              </Alert>
            ) : (
              anchors.map((anchor) => (
                <div key={anchor.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{anchor.type}</p>
                    <Badge variant="outline">
                      {new Date(anchor.payload.timestamp).toLocaleString()}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tx: {anchor.txHash.slice(0, 18)}…
                  </p>
                  <p className="text-xs text-muted-foreground">Network: {anchor.network ?? 'pilot-l2'}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Audit packet</CardTitle>
              <CardDescription>Downloadable JSON + PDF artifacts.</CardDescription>
            </div>
            <Button
              variant="outline"
              className="gap-2"
              disabled={!payload.packetArtifacts}
              onClick={() => downloadPacket(payload.packetArtifacts)}
            >
              <FileDown className="h-4 w-4" />
              Download
            </Button>
          </CardHeader>
          <CardContent>
            {payload.packetArtifacts ? (
              <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                Generated {new Date().toLocaleString()} •{' '}
                {Math.round((payload.packetArtifacts.json.length / 1024) * 10) / 10} KB JSON
              </div>
            ) : (
              <Alert>
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Packet unavailable</AlertTitle>
                <AlertDescription>File must be complete before download.</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Credential history</CardTitle>
          <CardDescription>Lifecycle entries derived from CR1 & CR3 payloads.</CardDescription>
        </CardHeader>
        <CardContent>
          {lifecycle.length === 0 ? (
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>No lifecycle events</AlertTitle>
              <AlertDescription>Collect CR1/CR3 evidence to build timeline.</AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Metadata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lifecycle.map((event: any) => (
                  <TableRow key={event.id}>
                    <TableCell>{new Date(event.occurredAt).toLocaleDateString()}</TableCell>
                    <TableCell>{event.label}</TableCell>
                    <TableCell>
                      <Badge variant={event.status === 'verified' ? 'default' : 'secondary'}>
                        {event.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {event.metadata?.jurisdiction || event.metadata?.source || '--'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chain verification proofs</CardTitle>
          <CardDescription>Latest anchored proofs for this clinician.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {anchors.length === 0 ? (
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>No chain proofs</AlertTitle>
              <AlertDescription>Run NCQA file-complete automation to anchor proofs.</AlertDescription>
            </Alert>
          ) : (
            anchors.map((anchor) => (
              <div key={`${anchor.id}-proof`} className="rounded-lg border p-3 text-sm flex items-center justify-between">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <Link className="h-4 w-4" />
                    {anchor.txHash.slice(0, 22)}…
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {anchor.type} • {anchor.payload.timestamp}
                  </p>
                </div>
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  anchored
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Separator />
    </div>
  );
}

function downloadPacket(packet?: FileCompletePayload['packetArtifacts'] | null) {
  if (!packet) return;
  const blob = new Blob([packet.json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = packet.pdfFileName?.replace('.pdf', '.json') || 'audit-packet.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildMockPayload(clinicianId: string): FileCompletePayload {
  return {
    clinicianId,
    ready: true,
    missingCategories: [],
    staleCategories: [],
    evidenceSummary: {
      CR1: { count: 2, latestAt: new Date().toISOString() },
      CR2: { count: 1, latestAt: new Date().toISOString() },
      CR3: { count: 3, latestAt: new Date().toISOString() },
      CR4: { count: 1, latestAt: new Date().toISOString() },
      CR5: { count: 1, latestAt: new Date().toISOString() },
    },
    anchors: [
      {
        id: crypto.randomUUID(),
        type: 'auditEvidenceCommitted',
        txHash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        payload: { timestamp: new Date().toISOString(), clinicianId },
      },
    ],
    packetArtifacts: {
      json: JSON.stringify(
        {
          credentialLifecycle: [
            {
              id: 'mock-license',
              label: 'NY License',
              occurredAt: new Date().toISOString(),
              status: 'verified',
              metadata: { jurisdiction: 'NY' },
            },
          ],
        },
        null,
        2,
      ),
      pdfBase64: '',
      pdfFileName: 'ncqa-audit-mock.pdf',
    },
  };
}










