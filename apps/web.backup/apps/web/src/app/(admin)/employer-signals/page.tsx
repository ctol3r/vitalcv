'use client';

import { useEffect, useState } from 'react';
import { Signal, TrendingUp, TrendingDown, Users, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function EmployerSignalsPage() {
  const [orgId, setOrgId] = useState('');
  const [signals, setSignals] = useState<any>(null);
  const [interestPredictions, setInterestPredictions] = useState<any[]>([]);
  const [dropOffs, setDropOffs] = useState<any[]>([]);
  const [negativeSignals, setNegativeSignals] = useState<any[]>([]);
  const [correlations, setCorrelations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSignals = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/employer-signals/${orgId}`);
      if (res.ok) {
        const data = await res.json();
        setSignals(data.signals);
      }

      // Fetch interest predictions
      const interestRes = await fetch(`${API_BASE}/api/employer-signals/predict-interest/${orgId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicianIds: ['clin_1', 'clin_2', 'clin_3'] }),
      });
      if (interestRes.ok) {
        const interestData = await interestRes.json();
        setInterestPredictions(interestData.predictions || []);
      }

      // Fetch drop-offs
      const dropOffRes = await fetch(`${API_BASE}/api/employer-signals/dropoffs/${orgId}`);
      if (dropOffRes.ok) {
        const dropOffData = await dropOffRes.json();
        setDropOffs(dropOffData.analysis || []);
      }

      // Fetch negative signals
      const negativeRes = await fetch(`${API_BASE}/api/employer-signals/negative-signals/${orgId}`);
      if (negativeRes.ok) {
        const negativeData = await negativeRes.json();
        setNegativeSignals(negativeData.signals || []);
      }

      // Fetch correlations
      const corrRes = await fetch(`${API_BASE}/api/employer-signals/correlations/${orgId}`);
      if (corrRes.ok) {
        const corrData = await corrRes.json();
        setCorrelations(corrData.correlations || []);
      }
    } catch (error) {
      console.error('Failed to fetch signals', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Employer Signal Intelligence</h1>
        <p className="text-muted-foreground mt-2">
          High-resolution analysis of employer intent, behavior, risk & opportunity signals
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization ID</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Enter Organization ID</Label>
            <div className="flex gap-2 mt-2">
              <Input
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="org_123"
              />
              <Button onClick={fetchSignals} disabled={loading || !orgId}>
                {loading ? 'Loading...' : 'Analyze'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {signals && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="interest">Interest Predictions</TabsTrigger>
            <TabsTrigger value="dropoffs">Drop-Off Analysis</TabsTrigger>
            <TabsTrigger value="negative">Negative Signals</TabsTrigger>
            <TabsTrigger value="correlations">Correlations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Interview Speed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{signals.interviewSpeed || 0} hours</div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Average time from application to interview
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Signal className="h-5 w-5" />
                    Engagement Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {((signals.engagementRate || 0) * 100).toFixed(1)}%
                  </div>
                  <Progress value={(signals.engagementRate || 0) * 100} className="mt-2" />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="interest" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Interest Predictions</CardTitle>
                <CardDescription>Predicted likelihood of pursuing clinicians</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {interestPredictions.map((pred, idx) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{pred.clinicianId}</span>
                        <Badge variant="outline">
                          {(pred.probability * 100).toFixed(0)}% probability
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Factors: {pred.factors.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dropoffs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Drop-Off Analysis</CardTitle>
                <CardDescription>Detect stalled hiring processes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dropOffs.map((dropOff, idx) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{dropOff.stage}</span>
                        <Badge variant="destructive">
                          {(dropOff.dropOffRate * 100).toFixed(1)}% drop-off
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Reasons: {dropOff.reasons.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="negative" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Negative Signals</CardTitle>
                <CardDescription>Early signs employer may reject candidate</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {negativeSignals.map((signal, idx) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{signal.type}</span>
                        <Badge variant={signal.severity > 7 ? 'destructive' : 'secondary'}>
                          Severity: {signal.severity}/10
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{signal.description}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="correlations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Signal Correlations</CardTitle>
                <CardDescription>Correlate employer signals → hire success</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {correlations.map((corr, idx) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{corr.signal} → {corr.outcome}</span>
                        <Badge variant="outline">
                          {corr.correlation.toFixed(2)}
                        </Badge>
                      </div>
                      <Progress value={Math.abs(corr.correlation) * 100} className="mt-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}








