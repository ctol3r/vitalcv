'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Shield, AlertTriangle, TrendingUp, Map } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function OperationalSafetyPage() {
  const [loading, setLoading] = useState(true);
  const [orgId] = useState('demo-org-1'); // In production, get from auth
  const [score, setScore] = useState<number | null>(null);
  const [signals, setSignals] = useState<any[]>([]);
  const [hazards, setHazards] = useState<any[]>([]);
  const [risk, setRisk] = useState<any>(null);
  const [remediation, setRemediation] = useState<any[]>([]);

  useEffect(() => {
    loadSafety();
  }, [orgId]);

  async function loadSafety() {
    try {
      setLoading(true);
      const [scoreRes, signalsRes, hazardsRes, riskRes, remediationRes] = await Promise.all([
        fetch(`${API_BASE}/api/operational-safety/${orgId}`),
        fetch(`${API_BASE}/api/operational-safety/${orgId}/signals`),
        fetch(`${API_BASE}/api/operational-safety/${orgId}/hazards`),
        fetch(`${API_BASE}/api/operational-safety/${orgId}/risk`),
        fetch(`${API_BASE}/api/operational-safety/${orgId}/remediation`),
      ]);

      const scoreData = await scoreRes.json();
      if (scoreData.success) {
        setScore(scoreData.score);
      }

      const signalsData = await signalsRes.json();
      if (signalsData.success) {
        setSignals(signalsData.signals || []);
      }

      const hazardsData = await hazardsRes.json();
      if (hazardsData.success) {
        setHazards(hazardsData.hazards || []);
      }

      const riskData = await riskRes.json();
      if (riskData.success) {
        setRisk(riskData.risk);
      }

      const remediationData = await remediationRes.json();
      if (remediationData.success) {
        setRemediation(remediationData.plan || []);
      }
    } catch (error) {
      console.error('Failed to load safety:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Employer Operational Safety Grid</h1>
        <p className="text-muted-foreground mt-2">
          A dynamic grid scoring how safe, compliant, and ethical each employer's operations are
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Safety Score
            </CardTitle>
            <CardDescription>Overall operational safety rating</CardDescription>
          </CardHeader>
          <CardContent>
            {score !== null && (
              <>
                <div className="text-3xl font-bold mb-2">{score.toFixed(1)}/100</div>
                <Progress value={score} className="mt-4" />
                <div className="flex items-center gap-2 mt-4">
                  {score >= 80 ? (
                    <Badge variant="default" className="bg-green-500">
                      High Safety
                    </Badge>
                  ) : score >= 60 ? (
                    <Badge variant="default" className="bg-yellow-500">
                      Medium Safety
                    </Badge>
                  ) : (
                    <Badge variant="default" className="bg-red-500">
                      Low Safety
                    </Badge>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Safety Signals
            </CardTitle>
            <CardDescription>NPDB, OIG, internal sanctions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {signals.map((signal, i) => (
                <div key={i} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <Badge variant="outline">{signal.source}</Badge>
                    <span className="ml-2 text-sm">{signal.description}</span>
                  </div>
                  <Badge
                    variant={
                      signal.severity === 'critical'
                        ? 'destructive'
                        : signal.severity === 'high'
                        ? 'default'
                        : 'outline'
                    }
                  >
                    {signal.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Operational Hazards
            </CardTitle>
            <CardDescription>Classified unsafe behaviors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {hazards.length > 0 ? (
                hazards.map((hazard, i) => (
                  <div key={i} className="p-2 border rounded">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{hazard.type}</span>
                      <Badge variant="destructive">{hazard.severity}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{hazard.description}</p>
                  </div>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No hazards detected</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Predictive Risk
            </CardTitle>
            <CardDescription>Forecasted future employer risk</CardDescription>
          </CardHeader>
          <CardContent>
            {risk && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    variant={
                      risk.riskLevel === 'high'
                        ? 'destructive'
                        : risk.riskLevel === 'medium'
                        ? 'default'
                        : 'outline'
                    }
                  >
                    {risk.riskLevel.toUpperCase()}
                  </Badge>
                  <span className="text-2xl font-bold">{risk.score}/100</span>
                </div>
                <div className="space-y-1 mt-4">
                  {risk.factors.map((factor: string, i: number) => (
                    <div key={i} className="text-sm text-muted-foreground">
                      • {factor}
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {remediation.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              Remediation Plan
            </CardTitle>
            <CardDescription>Recommended actions for improvement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {remediation.map((action, i) => (
                <div key={i} className="p-3 border rounded">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{action.action}</span>
                    <Badge variant={action.priority === 'high' ? 'destructive' : 'default'}>
                      {action.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">Timeline: {action.timeline}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

