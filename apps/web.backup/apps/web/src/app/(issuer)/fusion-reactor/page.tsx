'use client';

import { AlertCircle, Anchor, Download, Zap, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

interface SignalFusionReactorData {
  credentialId: string;
  credibility: number;
  coherence: {
    coherent: boolean;
    confidence: number;
  };
  stability: {
    current: number;
    predicted: number;
  };
  harmonization: {
    harmonized: boolean;
  };
}

export default function FusionReactorPage() {
  const [credentialId, setCredentialId] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SignalFusionReactorData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchReactor = async () => {
    if (!credentialId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/signal-fusion/${credentialId}`);
      if (!res.ok) throw new Error('Failed to fetch fusion reactor');
      setData(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8" />
            Credential Signal Fusion Reactor
          </h1>
          <p className="text-muted-foreground mt-2">
            Fuse all credential signals — chain, issuer, regulatory, evidence — into a single credibility reactor
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fusion Reactor Analysis</CardTitle>
          <CardDescription>Enter a credential ID to view fusion reactor data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Credential ID"
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchReactor()}
            />
            <Button onClick={fetchReactor} disabled={loading || !credentialId.trim()}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Analyze
            </Button>
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {loading && !data && <Skeleton className="h-64 w-full" />}

          {data && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Credibility</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold">{data.credibility}</div>
                      <Progress value={data.credibility} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Coherence</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Badge variant={data.coherence.coherent ? 'default' : 'destructive'}>
                        {data.coherence.coherent ? 'Coherent' : 'Incoherent'}
                      </Badge>
                      <Progress value={data.coherence.confidence} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Stability</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Current</div>
                      <div className="text-2xl font-bold">{data.stability.current}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Predicted</div>
                      <div className="text-2xl font-bold">{data.stability.predicted}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Harmonization</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant={data.harmonization.harmonized ? 'default' : 'destructive'}>
                    {data.harmonization.harmonized ? 'Harmonized' : 'Conflicts Detected'}
                  </Badge>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








