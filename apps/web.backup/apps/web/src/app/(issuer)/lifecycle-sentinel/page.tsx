'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

/**
 * Batch 387.4 - Lifecycle Sentinel UI
 */

export default function LifecycleSentinelPage() {
  const [credentialId, setCredentialId] = useState('');
  const [sentinel, setSentinel] = useState<any>(null);
  const [monitoring, setMonitoring] = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSentinel = async () => {
    if (!credentialId) return;
    setLoading(true);
    try {
      const [sentinelRes, monitorRes, predictionsRes] = await Promise.all([
        fetch(`/api/lifecycle-sentinel/${credentialId}`),
        fetch(`/api/lifecycle-sentinel/${credentialId}/monitor`),
        fetch(`/api/lifecycle-sentinel/${credentialId}/predictions`),
      ]);
      const [sentinelData, monitorData, predictionsData] = await Promise.all([
        sentinelRes.json(),
        monitorRes.json(),
        predictionsRes.json(),
      ]);
      setSentinel(sentinelData);
      setMonitoring(monitorData);
      setPredictions(predictionsData.predictions || []);
    } catch (error) {
      console.error('Failed to fetch sentinel:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Credential Lifecycle Sentinel</h1>

      <Card>
        <CardHeader>
          <CardTitle>Lifecycle Monitoring</CardTitle>
          <CardDescription>Monitor credential life, predict failures, trigger corrections</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter credential ID"
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
            />
            <Button onClick={fetchSentinel} disabled={loading}>
              Monitor
            </Button>
          </div>

          {monitoring && (
            <div className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Monitoring Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Expirations Detected</span>
                      <Badge>{monitoring.expirations?.length || 0}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Revocations</span>
                      <Badge>{monitoring.revocations?.detected ? 'Yes' : 'No'}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Missing Evidence</span>
                      <Badge>{monitoring.missingEvidence?.detected ? 'Yes' : 'No'}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Drift Signals</span>
                      <Badge>{monitoring.driftSignals?.detected ? 'Yes' : 'No'}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {predictions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Failure Predictions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {predictions.map((pred, i) => (
                    <div key={i} className="border p-3 rounded">
                      <div className="flex justify-between">
                        <span>Failure Probability</span>
                        <Badge>{(pred.failureProbability * 100).toFixed(1)}%</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Days until: {pred.daysUntil}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Risk Factors: {pred.riskFactors.join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

