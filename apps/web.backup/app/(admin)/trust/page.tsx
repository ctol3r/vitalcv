'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Download, ShieldCheck, Trash2, Plus } from 'lucide-react';

interface TrustedIssuer {
  did: string;
  orgNpi: string;
  orgName: string;
  addedAt: string;
}

interface TrustEvent {
  id: string;
  type: 'trustedIssuerAdded' | 'trustedIssuerRemoved';
  did: string;
  orgNpi: string;
  timestamp: string;
  txHash: string;
}

const initialIssuers: TrustedIssuer[] = [
  {
    did: 'did:web:hospital-a.vital',
    orgNpi: '1234567890',
    orgName: 'Hospital A',
    addedAt: '2025-11-01T10:00:00Z',
  },
  {
    did: 'did:web:issuer.vital',
    orgNpi: '0987654321',
    orgName: 'Vital Issuer',
    addedAt: '2025-11-02T14:30:00Z',
  },
];

export default function TrustRegistryAdminPage() {
  const [issuers, setIssuers] = useState<TrustedIssuer[]>(initialIssuers);
  const [events, setEvents] = useState<TrustEvent[]>([]);
  const [form, setForm] = useState({ did: '', orgNpi: '', orgName: '' });
  const [error, setError] = useState<string | null>(null);

  const handleAddIssuer = () => {
    if (!form.did || !form.orgNpi || !form.orgName) {
      setError('All fields are required.');
      return;
    }
    setError(null);

    const nextIssuer: TrustedIssuer = {
      ...form,
      addedAt: new Date().toISOString(),
    };

    setIssuers((prev) => [nextIssuer, ...prev]);
    setEvents((prev) => [
      {
        id: crypto.randomUUID(),
        type: 'trustedIssuerAdded',
        did: form.did,
        orgNpi: form.orgNpi,
        timestamp: new Date().toISOString(),
        txHash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
      },
      ...prev,
    ]);

    setForm({ did: '', orgNpi: '', orgName: '' });
  };

  const handleRemoveIssuer = (did: string) => {
    const removed = issuers.find((issuer) => issuer.did === did);
    setIssuers((prev) => prev.filter((issuer) => issuer.did !== did));
    if (removed) {
      setEvents((prev) => [
        {
          id: crypto.randomUUID(),
          type: 'trustedIssuerRemoved',
          did: removed.did,
          orgNpi: removed.orgNpi,
          timestamp: new Date().toISOString(),
          txHash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        },
        ...prev,
      ]);
    }
  };

  const handleExport = () => {
    const payload = JSON.stringify({ generatedAt: new Date().toISOString(), issuers }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'trusted-issuers.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const stats = useMemo(
    () => ({
      total: issuers.length,
      lastAdded: issuers[0]?.addedAt ? new Date(issuers[0].addedAt).toLocaleString() : 'N/A',
    }),
    [issuers],
  );

  return (
    <div className="container mx-auto max-w-5xl px-6 py-10 space-y-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Admin • Trust registry</p>
        <h1 className="text-3xl font-semibold tracking-tight">Trusted issuer registry</h1>
        <p className="text-muted-foreground">
          Manage DID trust anchors, review events, and export the current trust list.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Registry stats</CardTitle>
            <CardDescription>Chain-anchored issuers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Total issuers</p>
              <p className="text-3xl font-semibold">{stats.total}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Last added</p>
              <p className="text-lg font-medium">{stats.lastAdded}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Add issuer DID</CardTitle>
            <CardDescription>Anchor new issuers into the trust registry.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Missing fields</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div>
              <Label htmlFor="did">Issuer DID</Label>
              <Input
                id="did"
                value={form.did}
                placeholder="did:web:issuer.example"
                onChange={(event) => setForm((prev) => ({ ...prev, did: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="npi">Org NPI</Label>
              <Input
                id="npi"
                value={form.orgNpi}
                placeholder="1234567890"
                onChange={(event) => setForm((prev) => ({ ...prev, orgNpi: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="orgName">Org name</Label>
              <Input
                id="orgName"
                value={form.orgName}
                placeholder="Vital Issuer"
                onChange={(event) => setForm((prev) => ({ ...prev, orgName: event.target.value }))}
              />
            </div>
            <Button className="w-full gap-2" onClick={handleAddIssuer}>
              <Plus className="h-4 w-4" />
              Add issuer
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Active trusted issuers</CardTitle>
            <CardDescription>Chain anchored issuers with DID + NPI mapping.</CardDescription>
          </div>
          <Button variant="outline" className="gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export trust list
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>DID</TableHead>
                <TableHead>Org</TableHead>
                <TableHead>NPI</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issuers.map((issuer) => (
                <TableRow key={issuer.did}>
                  <TableCell className="font-mono text-xs">{issuer.did}</TableCell>
                  <TableCell>{issuer.orgName}</TableCell>
                  <TableCell>{issuer.orgNpi}</TableCell>
                  <TableCell>{new Date(issuer.addedAt).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveIssuer(issuer.did)}
                      aria-label="Remove issuer"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trust anchor events</CardTitle>
          <CardDescription>Ledger events for issuer add/remove operations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {events.length === 0 ? (
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>No events yet</AlertTitle>
              <AlertDescription>New anchors will appear once issuers are added or removed.</AlertDescription>
            </Alert>
          ) : (
            events.map((event) => (
              <div key={event.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium">
                    {event.type === 'trustedIssuerAdded' ? 'Issuer added' : 'Issuer removed'}
                  </p>
                  <Badge variant="outline">{new Date(event.timestamp).toLocaleString()}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  DID: <span className="font-mono">{event.did}</span>
                </p>
                <p className="text-xs text-muted-foreground">NPI: {event.orgNpi}</p>
                <p className="text-xs text-muted-foreground">Tx: {event.txHash.slice(0, 18)}…</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Separator />
    </div>
  );
}










