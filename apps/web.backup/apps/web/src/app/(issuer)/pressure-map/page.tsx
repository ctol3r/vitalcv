'use client';

import { useCallback, useEffect, useState } from 'react';
import { Gauge, AlertTriangle, TrendingUp, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function PressureMapPage() {
  const [credentialId, setCredentialId] = useState('');
  const [pressure, setPressure] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPressure = useCallback(async () => {
    if (!credentialId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/credential-pressure/${credentialId}`);
      if (!response.ok) {
        throw new Error(`Failed to load pressure (${response.status})`);
      }
      const data = await response.json();
      setPressure(data);
    } catch (err) {
      console.error('Failed to fetch pressure', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [credentialId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credential Integrity Pressure Matrix</h1>
          <p className="text-muted-foreground">
            A 30-axis matrix measuring the "pressure" acting on a credential: regulatory load, chain health, issuer consistency, evidence decay & cross-system interactions
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Credential Pressure Analysis</CardTitle>
          <CardDescription>Enter a credential ID to analyze pressure</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Credential ID"
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchPressure()}
            />
            <Button onClick={fetchPressure} disabled={loading || !credentialId}>
              {loading ? 'Loading...' : 'Analyze'}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {pressure && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Overall Pressure</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{pressure.overallPressure?.toFixed(1) || 0}</div>
                    <Progress value={pressure.overallPressure || 0} className="mt-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Pressure Risk Index</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{pressure.pressureRiskIndex?.toFixed(1) || 0}</div>
                    <Progress value={pressure.pressureRiskIndex || 0} className="mt-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Pressure Entropy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{pressure.pressureEntropy?.toFixed(1) || 0}</div>
                    <Progress value={pressure.pressureEntropy || 0} className="mt-2" />
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Regulatory Pressure</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>Regulatory Friction</span>
                      <Badge variant={pressure.regulatoryFriction > 50 ? 'destructive' : 'default'}>
                        {pressure.regulatoryFriction?.toFixed(1) || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Compliance Burden</span>
                      <Badge variant={pressure.complianceBurden > 50 ? 'destructive' : 'default'}>
                        {pressure.complianceBurden?.toFixed(1) || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Regulatory Volatility</span>
                      <Badge variant={pressure.regulatoryVolatility > 50 ? 'destructive' : 'default'}>
                        {pressure.regulatoryVolatility?.toFixed(1) || 0}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Chain Health</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>Chain Health</span>
                      <Badge variant={pressure.chainHealth < 70 ? 'destructive' : 'default'}>
                        {pressure.chainHealth?.toFixed(1) || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Chain Instability</span>
                      <Badge variant={pressure.chainInstability > 30 ? 'destructive' : 'default'}>
                        {pressure.chainInstability?.toFixed(1) || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Anchor Reliability</span>
                      <Badge variant={pressure.anchorReliability < 80 ? 'destructive' : 'default'}>
                        {pressure.anchorReliability?.toFixed(1) || 0}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Issuer Pressure</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>Issuer Fragility</span>
                      <Badge variant={pressure.issuerFragility > 30 ? 'destructive' : 'default'}>
                        {pressure.issuerFragility?.toFixed(1) || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Issuer Liability</span>
                      <Badge variant={pressure.issuerLiability > 30 ? 'destructive' : 'default'}>
                        {pressure.issuerLiability?.toFixed(1) || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Issuer Trust Decay</span>
                      <Badge variant={pressure.issuerTrustDecay > 20 ? 'destructive' : 'default'}>
                        {pressure.issuerTrustDecay?.toFixed(1) || 0}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Evidence Pressure</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>Evidence Staleness</span>
                      <Badge variant={pressure.evidenceStaleness > 30 ? 'destructive' : 'default'}>
                        {pressure.evidenceStaleness?.toFixed(1) || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Evidence Decay</span>
                      <Badge variant={pressure.evidenceDecay > 30 ? 'destructive' : 'default'}>
                        {pressure.evidenceDecay?.toFixed(1) || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Evidence Freshness</span>
                      <Badge variant={pressure.evidenceFreshness < 70 ? 'destructive' : 'default'}>
                        {pressure.evidenceFreshness?.toFixed(1) || 0}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








