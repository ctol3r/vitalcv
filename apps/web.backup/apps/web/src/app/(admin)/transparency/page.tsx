'use client';

import { useCallback, useState } from 'react';
import { Eye, AlertTriangle, TrendingUp, FileDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function TransparencyPage() {
  const [orgId, setOrgId] = useState('');
  const [transparency, setTransparency] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransparency = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/behavior-transparency/${orgId}`);
      if (!response.ok) {
        throw new Error(`Failed to load transparency (${response.status})`);
      }
      const data = await response.json();
      setTransparency(data);
    } catch (err) {
      console.error('Failed to fetch transparency', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const exportAudit = useCallback(async () => {
    if (!orgId) return;
    try {
      const response = await fetch(`${API_BASE}/api/behavior-transparency/export/${orgId}`);
      const data = await response.json();
      window.open(data.pdfUrl, '_blank');
    } catch (err) {
      console.error('Failed to export audit', err);
    }
  }, [orgId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Behavioral Transparency Layer</h1>
          <p className="text-muted-foreground">
            Force transparency into how employers behave, filter, decide, and influence the workforce
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View Employer Transparency</CardTitle>
          <CardDescription>Enter an organization ID to view transparency data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="Organization ID"
              className="flex-1"
            />
            <Button onClick={fetchTransparency} disabled={!orgId || loading}>
              View
            </Button>
            <Button onClick={exportAudit} variant="outline" disabled={!orgId}>
              <FileDown className="h-4 w-4 mr-2" />
              Export Audit
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && <p className="text-muted-foreground">Loading transparency data...</p>}

          {transparency && transparency.transparency && (
            <div className="space-y-4">
              {transparency.transparency.fairnessSignals && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Fairness Signals</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Diversity</span>
                      <Progress value={transparency.transparency.fairnessSignals.diversity * 100} className="w-32" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Consistency</span>
                      <Progress value={transparency.transparency.fairnessSignals.consistency * 100} className="w-32" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Bias Risk</span>
                      <Badge variant={transparency.transparency.fairnessSignals.biasRisk > 0.5 ? 'destructive' : 'default'}>
                        {(transparency.transparency.fairnessSignals.biasRisk * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              {transparency.transparency.riskSignals && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Risk Signals</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Compliance</span>
                      <Progress value={transparency.transparency.riskSignals.compliance * 100} className="w-32" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Safety</span>
                      <Progress value={transparency.transparency.riskSignals.safety * 100} className="w-32" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Reputation</span>
                      <Progress value={transparency.transparency.riskSignals.reputation * 100} className="w-32" />
                    </div>
                  </CardContent>
                </Card>
              )}

              {transparency.transparency.behaviorFingerprint && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Behavior Fingerprint</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Hiring Speed</span>
                      <Badge>{transparency.transparency.behaviorFingerprint.hiringSpeed} days</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Rejection Rate</span>
                      <Badge>{(transparency.transparency.behaviorFingerprint.rejectionRate * 100).toFixed(0)}%</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Engagement Level</span>
                      <Progress value={transparency.transparency.behaviorFingerprint.engagementLevel * 100} className="w-32" />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

