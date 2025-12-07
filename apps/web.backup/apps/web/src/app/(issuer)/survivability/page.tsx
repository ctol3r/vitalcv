'use client';

import { AlertCircle, Anchor, Download, RefreshCw, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

interface SurvivabilityData {
  credentialId: string;
  redundancy: {
    chains: Array<{ chain: string; anchored: boolean; txHash: string | null }>;
    issuerBackups: Array<{ issuerId: string; location: string; status: string }>;
    evidenceStores: Array<{ store: string; encrypted: boolean; hash: string }>;
    copies: number;
  };
  risk: {
    score: number;
    factors: Array<{ factor: string; impact: number; severity: string }>;
    fragilityPoints: string[];
  };
  gaps: {
    detected: boolean;
    gaps: Array<{ type: string; location: string; severity: string }>;
  };
  drift: {
    predicted: boolean;
    fragilityDate: string | null;
    riskTrajectory: Array<{ date: string; score: number }>;
  };
  recommendations: {
    suggestions: Array<{
      type: string;
      priority: string;
      reason: string;
      estimatedEffort: string;
    }>;
  };
}

export default function SurvivabilityPage() {
  const [credentialId, setCredentialId] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SurvivabilityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSurvivability = async () => {
    if (!credentialId.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/credential-survivability/${credentialId}`);
      if (!res.ok) throw new Error('Failed to fetch survivability data');
      const result = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBuild = async () => {
    if (!credentialId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/credential-survivability/${credentialId}/build`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to build survivability');
      const result = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnchor = async () => {
    if (!credentialId.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/credential-survivability/${credentialId}/anchor`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to anchor');
      alert('Survivability snapshot anchored successfully');
      fetchSurvivability();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleExport = async () => {
    if (!credentialId.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/credential-survivability/${credentialId}/dossier`);
      if (!res.ok) throw new Error('Failed to export dossier');
      const dossier = await res.json();
      const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `survivability-dossier-${credentialId}.json`;
      a.click();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Credential Survivability Engine
          </h1>
          <p className="text-muted-foreground mt-2">
            Monitor and guarantee credential redundancy and survivability across chains, issuers, and evidence stores
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Credential Survivability Analysis</CardTitle>
          <CardDescription>Enter a credential ID to analyze its survivability</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Credential ID"
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchSurvivability()}
            />
            <Button onClick={fetchSurvivability} disabled={loading || !credentialId.trim()}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Analyze
            </Button>
            <Button onClick={handleBuild} variant="outline" disabled={loading || !credentialId.trim()}>
              Build
            </Button>
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {loading && !data && (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}

          {data && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Risk Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Survivability Score</span>
                        <Badge variant={data.risk.score >= 80 ? 'default' : data.risk.score >= 60 ? 'secondary' : 'destructive'}>
                          {data.risk.score}/100
                        </Badge>
                      </div>
                      <Progress value={data.risk.score} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Redundancy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-2xl font-bold">{data.redundancy.copies}</div>
                      <div className="text-sm text-muted-foreground">Backup Copies</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Chain Anchors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.redundancy.chains.map((chain, i) => (
                      <div key={i} className="flex items-center justify-between p-2 border rounded">
                        <span className="font-mono text-sm">{chain.chain}</span>
                        <Badge variant={chain.anchored ? 'default' : 'destructive'}>
                          {chain.anchored ? 'Anchored' : 'Not Anchored'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {data.gaps.detected && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-destructive">Integrity Gaps Detected</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {data.gaps.gaps.map((gap, i) => (
                        <div key={i} className="p-2 border border-destructive/20 rounded">
                          <div className="font-semibold">{gap.type}</div>
                          <div className="text-sm text-muted-foreground">{gap.location}</div>
                          <Badge variant="destructive" className="mt-1">{gap.severity}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.recommendations.suggestions.map((rec, i) => (
                      <div key={i} className="p-2 border rounded">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{rec.type}</span>
                          <Badge variant={rec.priority === 'critical' ? 'destructive' : rec.priority === 'high' ? 'default' : 'secondary'}>
                            {rec.priority}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">{rec.reason}</div>
                        <div className="text-xs text-muted-foreground mt-1">Effort: {rec.estimatedEffort}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button onClick={handleAnchor}>
                  <Anchor className="h-4 w-4 mr-2" />
                  Anchor Snapshot
                </Button>
                <Button onClick={handleExport} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export Dossier
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

