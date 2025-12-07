'use client';

import { useCallback, useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Activity, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function EthicalGradientPage() {
  const [orgId, setOrgId] = useState('');
  const [gradient, setGradient] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGradient = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/ethical-coherence/${orgId}`);
      if (!response.ok) {
        throw new Error(`Failed to load gradient (${response.status})`);
      }
      const data = await response.json();
      setGradient(data);
    } catch (err) {
      console.error('Failed to fetch gradient', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ethical Coherence Gradient Engine</h1>
          <p className="text-muted-foreground">
            A 30-axis gradient system modeling employer ethical direction, magnitude, stability, and divergence across all behavioral signals
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ethical Coherence Analysis</CardTitle>
          <CardDescription>Enter an organization ID to analyze ethical coherence</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Organization ID"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchGradient()}
            />
            <Button onClick={fetchGradient} disabled={loading || !orgId}>
              {loading ? 'Loading...' : 'Analyze'}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {gradient && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Overall Coherence</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{gradient.overallCoherence?.toFixed(1) || 0}</div>
                    <Progress value={gradient.overallCoherence || 0} className="mt-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Ethical Direction</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {gradient.ethicalDirection > 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : gradient.ethicalDirection < 0 ? (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      ) : (
                        <Activity className="h-4 w-4 text-gray-500" />
                      )}
                      <div className="text-2xl font-bold">{gradient.ethicalDirection?.toFixed(1) || 0}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Ethical Stability</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{gradient.ethicalStability?.toFixed(1) || 0}</div>
                    <Progress value={gradient.ethicalStability || 0} className="mt-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Risk-Adjusted Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{gradient.riskAdjustedEthicalScore?.toFixed(1) || 0}</div>
                    <Progress value={gradient.riskAdjustedEthicalScore || 0} className="mt-2" />
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Core Ethical Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>Fairness Metrics</span>
                      <Badge variant={gradient.fairnessMetrics < 70 ? 'destructive' : 'default'}>
                        {gradient.fairnessMetrics?.toFixed(1) || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Transparency Deltas</span>
                      <Badge variant={gradient.transparencyDeltas < 70 ? 'destructive' : 'default'}>
                        {gradient.transparencyDeltas?.toFixed(1) || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Safety Alignment</span>
                      <Badge variant={gradient.safetyAlignment < 70 ? 'destructive' : 'default'}>
                        {gradient.safetyAlignment?.toFixed(1) || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Verification Accuracy</span>
                      <Badge variant={gradient.verificationAccuracy < 70 ? 'destructive' : 'default'}>
                        {gradient.verificationAccuracy?.toFixed(1) || 0}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Anomaly Detection</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>Bias Detection</span>
                      <Badge variant={gradient.biasDetection > 10 ? 'destructive' : 'default'}>
                        {gradient.biasDetection?.toFixed(1) || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Breach Detection</span>
                      <Badge variant={gradient.breachDetection > 10 ? 'destructive' : 'default'}>
                        {gradient.breachDetection?.toFixed(1) || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Negligence Detection</span>
                      <Badge variant={gradient.negligenceDetection > 10 ? 'destructive' : 'default'}>
                        {gradient.negligenceDetection?.toFixed(1) || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Concealment Detection</span>
                      <Badge variant={gradient.concealmentDetection > 10 ? 'destructive' : 'default'}>
                        {gradient.concealmentDetection?.toFixed(1) || 0}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Trust & Resonance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>Ethical Resonance</span>
                      <Badge variant={gradient.ethicalResonance < 70 ? 'destructive' : 'default'}>
                        {gradient.ethicalResonance?.toFixed(1) || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Value Alignment</span>
                      <Badge variant={gradient.valueAlignment < 70 ? 'destructive' : 'default'}>
                        {gradient.valueAlignment?.toFixed(1) || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Trustline Coupling</span>
                      <Badge variant={gradient.trustlineCoupling < 70 ? 'destructive' : 'default'}>
                        {gradient.trustlineCoupling?.toFixed(1) || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Trust-Aware Harmonization</span>
                      <Badge variant={gradient.trustAwareHarmonization < 70 ? 'destructive' : 'default'}>
                        {gradient.trustAwareHarmonization?.toFixed(1) || 0}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Burnout & Drift</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>Burnout Propagation</span>
                      <Badge variant={gradient.burnoutPropagation > 15 ? 'destructive' : 'default'}>
                        {gradient.burnoutPropagation?.toFixed(1) || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Burnout-Linked Inversion</span>
                      <Badge variant={gradient.burnoutLinkedInversion > 15 ? 'destructive' : 'default'}>
                        {gradient.burnoutLinkedInversion?.toFixed(1) || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Drift Magnitude</span>
                      <Badge variant={gradient.driftMagnitude > 10 ? 'destructive' : 'default'}>
                        {gradient.driftMagnitude?.toFixed(1) || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Coherence Entropy</span>
                      <Badge variant={gradient.coherenceEntropy > 20 ? 'destructive' : 'default'}>
                        {gradient.coherenceEntropy?.toFixed(1) || 0}
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








