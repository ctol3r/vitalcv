'use client';

import { useEffect, useState } from 'react';
import { Shield, AlertTriangle, CheckCircle2, RefreshCcw, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

interface VerifierIntel {
  trustPaths?: Array<{ credentialId: string; verified: boolean }>;
  compliance?: Record<string, { status: string; lastChecked: Date }>;
  anomalies?: Array<{ type: string; severity: string }>;
  trustScore?: { score: number; factors: Record<string, number> };
}

export default function VerifierIntelPage() {
  const [intel, setIntel] = useState<VerifierIntel | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifierId, setVerifierId] = useState('');

  useEffect(() => {
    setVerifierId('demo_verifier_123');
    loadIntel('demo_verifier_123');
  }, []);

  async function loadIntel(id: string) {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/verifier-intel/${id}`);
      if (response.ok) {
        const data = await response.json();
        setIntel(data.intel || {});
      }
    } catch (error) {
      console.error('Failed to load verifier intel:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnchor() {
    try {
      const response = await fetch(`${API_BASE}/api/verifier-intel/${verifierId}/anchor`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        alert(`Anchored! TX: ${data.txHash}`);
      }
    } catch (error) {
      console.error('Failed to anchor:', error);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Verifier · Intelligence Hub</Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Verifier Intelligence</h1>
            <p className="text-muted-foreground">
              System-level intelligence, compliance insights, and trust pathways
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => loadIntel(verifierId)}
              disabled={loading}
            >
              <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleAnchor}>
              Anchor Snapshot
            </Button>
          </div>
        </div>
      </header>

      {intel && (
        <div className="grid gap-6 md:grid-cols-2">
          {intel.trustScore && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Trust Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-semibold">{intel.trustScore.score}</span>
                  <Badge
                    variant={
                      intel.trustScore.score >= 80
                        ? 'default'
                        : intel.trustScore.score >= 60
                          ? 'secondary'
                          : 'destructive'
                    }
                  >
                    {intel.trustScore.score >= 80
                      ? 'High'
                      : intel.trustScore.score >= 60
                        ? 'Medium'
                        : 'Low'}
                  </Badge>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  {Object.entries(intel.trustScore.factors).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-muted-foreground">{key}</span>
                      <span className="font-semibold">{value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {intel.compliance && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Compliance Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(intel.compliance).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="font-semibold">{key.toUpperCase()}</div>
                        <div className="text-sm text-muted-foreground">
                          Last checked: {new Date(value.lastChecked).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge
                        variant={value.status === 'compliant' || value.status === 'active' ? 'default' : 'secondary'}
                      >
                        {value.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {intel.anomalies && intel.anomalies.length > 0 && (
            <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-5 w-5" />
                  Anomalies Detected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {intel.anomalies.map((anomaly, idx) => (
                    <div key={idx} className="rounded-lg border border-amber-300 p-2">
                      <div className="font-semibold text-amber-900 dark:text-amber-100">
                        {anomaly.type}
                      </div>
                      <Badge
                        variant={
                          anomaly.severity === 'high'
                            ? 'destructive'
                            : anomaly.severity === 'medium'
                              ? 'secondary'
                              : 'outline'
                        }
                        className="mt-1"
                      >
                        {anomaly.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {intel.trustPaths && intel.trustPaths.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Trust Paths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {intel.trustPaths.map((path, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg border p-2">
                      <span className="font-mono text-sm">{path.credentialId.slice(0, 16)}...</span>
                      <Badge variant={path.verified ? 'default' : 'secondary'}>
                        {path.verified ? 'Verified' : 'Pending'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

