'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RefreshCcw, Download, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CredentialRestoration {
  damagedEvidence: Array<{ field: string; severity: number; detectedAt: string }>;
  reconstructed: Record<string, { value: any; confidence: number; sources: string[] }>;
  confidence: number;
  verified: boolean;
  canonicalVC?: any;
  narrative: string;
  restoredAt: string;
}

export default function CredentialRestorationPage() {
  const [restoration, setRestoration] = useState<CredentialRestoration | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading');
  const [credentialId, setCredentialId] = useState('demo-credential-id');

  useEffect(() => {
    void loadRestoration();
  }, [credentialId]);

  async function loadRestoration() {
    setStatus('loading');
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const response = await fetch(`${baseUrl}/api/credential-restoration/${credentialId}`);
      if (!response.ok) throw new Error('Failed to load restoration');
      const data = await response.json();
      setRestoration(data);
      setStatus('idle');
    } catch (error) {
      console.warn('[restoration]', error);
      setStatus('error');
    }
  }

  async function handleExport() {
    if (!restoration) return;
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const response = await fetch(`${baseUrl}/api/credential-restoration/${credentialId}/export`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credential-restoration-${Date.now()}.json`;
    a.click();
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Issuer · Credential Restoration</Badge>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Credential Restoration Engine</h1>
            <p className="text-muted-foreground">
              Reconstruct, regenerate, and restore credentials from damaged, missing, or partial evidence.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={!restoration}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" onClick={loadRestoration} disabled={status === 'loading'}>
              <RefreshCcw className={cn('mr-2 h-4 w-4', status === 'loading' && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {restoration && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Restoration Confidence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Overall Confidence</span>
                  <span className="font-semibold">{(restoration.confidence * 100).toFixed(1)}%</span>
                </div>
                <Progress value={restoration.confidence * 100} className="h-3" />
              </div>
              <Badge variant={restoration.verified ? 'default' : 'secondary'}>
                {restoration.verified ? 'Verified' : 'Unverified'}
              </Badge>
            </CardContent>
          </Card>

          {restoration.damagedEvidence.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Damaged Evidence Detected</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {restoration.damagedEvidence.map((evidence, idx) => (
                    <div key={idx} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{evidence.field}</span>
                        <Badge variant={evidence.severity > 0.5 ? 'destructive' : 'secondary'}>
                          {(evidence.severity * 100).toFixed(0)}% severity
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {Object.keys(restoration.reconstructed).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Reconstructed Fields</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(restoration.reconstructed).map(([field, data]) => (
                    <div key={field} className="rounded-lg border p-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium capitalize">{field.replace(/_/g, ' ')}</span>
                          <Badge variant={data.confidence > 0.8 ? 'default' : 'secondary'}>
                            {(data.confidence * 100).toFixed(0)}% confidence
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Value: {JSON.stringify(data.value)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Sources: {data.sources.join(', ')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Restoration Narrative</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{restoration.narrative}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

