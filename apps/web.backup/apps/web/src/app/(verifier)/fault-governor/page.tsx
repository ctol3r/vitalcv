'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function FaultGovernorPage() {
  const [governor, setGovernor] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchGovernor = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/verification-fault-governor`);
      if (response.ok) {
        const data = await response.json();
        setGovernor(data.governor);
      }
    } catch (err) {
      console.error('Failed to fetch governor', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGovernor();
  }, [fetchGovernor]);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Multi-Chain Verification Fault-Tolerance Governor</h1>
        <p className="text-muted-foreground">
          Govern how verification behaves under chain failures, latency spikes, or partial invalidity
        </p>
      </div>

      {loading && <p className="text-muted-foreground">Loading governor state...</p>}

      {governor && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fault State</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Badge variant={governor.faultState.detected ? 'destructive' : 'default'}>
                  {governor.faultState.detected ? 'FAULT DETECTED' : 'NORMAL'}
                </Badge>
                <span className="text-sm">Severity: {governor.faultState.severity}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Verification Logic</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Degraded:</span>
                  <Badge variant={governor.verificationLogic.degraded ? 'destructive' : 'default'}>
                    {governor.verificationLogic.degraded ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div>
                  <span className="text-sm">Pathways: </span>
                  {governor.verificationLogic.pathways.map((path: string) => (
                    <Badge key={path} variant="outline" className="ml-2">{path}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fallback Proof</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-sm">Type:</span>
                <Badge>{governor.fallbackProof.type}</Badge>
                <span className="text-sm">Selected: {governor.fallbackProof.selected ? 'Yes' : 'No'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Failure Prediction</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Risk:</span>
                  <span className="text-lg font-bold">{governor.prediction.failureRisk}/100</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Timeframe: {governor.prediction.timeframe}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

