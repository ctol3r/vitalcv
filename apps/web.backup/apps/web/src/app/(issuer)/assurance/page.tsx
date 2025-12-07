'use client';

import { useCallback, useState } from 'react';
import { ShieldCheck, TrendingDown, FileDown, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function AssurancePage() {
  const [credentialId, setCredentialId] = useState('');
  const [assurance, setAssurance] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssurance = useCallback(async () => {
    if (!credentialId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/credential-assurance/${credentialId}`);
      if (!response.ok) {
        throw new Error(`Failed to load assurance (${response.status})`);
      }
      const data = await response.json();
      setAssurance(data);
    } catch (err) {
      console.error('Failed to fetch assurance', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [credentialId]);

  const anchorSnapshot = useCallback(async () => {
    if (!credentialId) return;
    try {
      const response = await fetch(`${API_BASE}/api/credential-assurance/${credentialId}/anchor`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to anchor snapshot');
      }
      alert('Assurance snapshot anchored successfully');
    } catch (err) {
      console.error('Failed to anchor snapshot', err);
      alert('Failed to anchor snapshot');
    }
  }, [credentialId]);

  const exportAudit = useCallback(async () => {
    if (!credentialId) return;
    try {
      const response = await fetch(`${API_BASE}/api/credential-assurance/${credentialId}/export`);
      if (!response.ok) {
        throw new Error('Failed to export audit');
      }
      const data = await response.json();
      const blob = new Blob([data.pdfData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assurance-${credentialId}-${Date.now()}.json`;
      a.click();
    } catch (err) {
      console.error('Failed to export audit', err);
      alert('Failed to export audit');
    }
  }, [credentialId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credential Assurance Probability Engine</h1>
          <p className="text-muted-foreground">
            Compute the probability that each credential is correct, current, and trustworthy
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View Credential Assurance</CardTitle>
          <CardDescription>Enter a credential ID to view assurance probability</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              placeholder="Credential ID"
              className="flex-1"
            />
            <Button onClick={fetchAssurance} disabled={!credentialId || loading}>
              View
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {assurance && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Assurance Probability</CardTitle>
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(assurance.assurance?.probability * 100 || 0).toFixed(1)}%
                </div>
                <Progress value={assurance.assurance?.probability * 100 || 0} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Evidence Density</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(assurance.assurance?.evidenceDensity * 100 || 0).toFixed(1)}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Trust Weight</CardTitle>
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(assurance.assurance?.trustWeight * 100 || 0).toFixed(1)}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Deviations</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{assurance.deviations?.length || 0}</div>
              </CardContent>
            </Card>
          </div>

          {assurance.evidenceCoverage && (
            <Card>
              <CardHeader>
                <CardTitle>Evidence Coverage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(assurance.evidenceCoverage).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="capitalize">{key.replace('_', ' ')}</span>
                    <Badge variant={value ? 'default' : 'secondary'}>
                      {value ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {assurance.issuanceFrequency && (
            <Card>
              <CardHeader>
                <CardTitle>Issuance Frequency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Count</span>
                    <Badge>{assurance.issuanceFrequency.count}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Pattern</span>
                    <Badge>{assurance.issuanceFrequency.pattern}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Suspicious</span>
                    <Badge variant={assurance.issuanceFrequency.suspicious ? 'destructive' : 'default'}>
                      {assurance.issuanceFrequency.suspicious ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Button onClick={anchorSnapshot} variant="outline">
              <CheckCircle className="mr-2 h-4 w-4" />
              Anchor Snapshot
            </Button>
            <Button onClick={exportAudit} variant="outline">
              <FileDown className="mr-2 h-4 w-4" />
              Export Audit
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

