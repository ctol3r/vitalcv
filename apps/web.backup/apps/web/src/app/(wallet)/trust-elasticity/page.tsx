'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, AlertTriangle, Anchor, Download } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

interface TrustElasticityData {
  elasticityCoefficient: number;
  shockResponse: {
    sanctions?: number;
    newVCs?: number;
    updates?: number;
  };
  positiveReinforcement: number;
  negativeDampening: number;
  cascadeRisk: number;
  drift: number;
  signals: Array<{
    type: string;
    impact: number;
    timestamp: string;
  }>;
}

export default function TrustElasticityPage() {
  const [elasticity, setElasticity] = useState<TrustElasticityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [clinicianId, setClinicianId] = useState('self');

  useEffect(() => {
    loadElasticity();
  }, [clinicianId]);

  async function loadElasticity() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/trust/elasticity/${clinicianId}`);
      if (res.ok) {
        const data = await res.json();
        setElasticity(data);
      }
    } catch (error) {
      console.error('Failed to load trust elasticity', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnchor() {
    try {
      const res = await fetch(`${API_BASE}/api/trust/elasticity/${clinicianId}/anchor`, {
        method: 'POST',
      });
      if (res.ok) {
        const { txHash } = await res.json();
        alert(`Anchored to chain: ${txHash}`);
      }
    } catch (error) {
      console.error('Failed to anchor', error);
    }
  }

  async function handleExport() {
    try {
      const res = await fetch(`${API_BASE}/api/trust/elasticity/${clinicianId}/export`);
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trust-elasticity-${clinicianId}.json`;
        a.click();
      }
    } catch (error) {
      console.error('Failed to export', error);
    }
  }

  if (loading) {
    return <div className="container mx-auto p-6">Loading trust elasticity data...</div>;
  }

  if (!elasticity) {
    return <div className="container mx-auto p-6">No elasticity data available</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Trust Elasticity Engine</h1>
          <p className="text-muted-foreground">Measure how trust rises or falls under pressure</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExport} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={handleAnchor} variant="outline">
            <Anchor className="w-4 h-4 mr-2" />
            Anchor
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elasticity Coefficient</CardTitle>
          <CardDescription>Overall trust elasticity score (0-1)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span>Elasticity Score</span>
                <span className="font-bold">{(elasticity.elasticityCoefficient * 100).toFixed(1)}%</span>
              </div>
              <Progress value={elasticity.elasticityCoefficient * 100} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span>Positive Reinforcement</span>
                  <span className="ml-auto font-bold">{(elasticity.positiveReinforcement * 100).toFixed(1)}%</span>
                </div>
                <Progress value={elasticity.positiveReinforcement * 100} className="h-2" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <span>Negative Dampening</span>
                  <span className="ml-auto font-bold">{(elasticity.negativeDampening * 100).toFixed(1)}%</span>
                </div>
                <Progress value={elasticity.negativeDampening * 100} className="h-2" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Shock Response</CardTitle>
            <CardDescription>Trust response to major events</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {elasticity.shockResponse.sanctions !== undefined && (
              <div>
                <div className="flex justify-between mb-2">
                  <span>Sanctions Impact</span>
                  <Badge variant={elasticity.shockResponse.sanctions > 0.5 ? 'destructive' : 'secondary'}>
                    {(elasticity.shockResponse.sanctions * 100).toFixed(1)}%
                  </Badge>
                </div>
                <Progress value={elasticity.shockResponse.sanctions * 100} />
              </div>
            )}
            {elasticity.shockResponse.newVCs !== undefined && (
              <div>
                <div className="flex justify-between mb-2">
                  <span>New VCs Impact</span>
                  <Badge variant="secondary">{(elasticity.shockResponse.newVCs * 100).toFixed(1)}%</Badge>
                </div>
                <Progress value={elasticity.shockResponse.newVCs * 100} />
              </div>
            )}
            {elasticity.shockResponse.updates !== undefined && (
              <div>
                <div className="flex justify-between mb-2">
                  <span>Updates Impact</span>
                  <Badge variant="secondary">{(elasticity.shockResponse.updates * 100).toFixed(1)}%</Badge>
                </div>
                <Progress value={elasticity.shockResponse.updates * 100} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk Metrics</CardTitle>
            <CardDescription>Cascade and drift analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span>Cascade Risk</span>
                <Badge variant={elasticity.cascadeRisk > 0.7 ? 'destructive' : 'secondary'}>
                  {(elasticity.cascadeRisk * 100).toFixed(1)}%
                </Badge>
              </div>
              <Progress value={elasticity.cascadeRisk * 100} />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span>Elasticity Drift</span>
                <Badge variant={elasticity.drift > 0.3 ? 'destructive' : 'secondary'}>
                  {(elasticity.drift * 100).toFixed(1)}%
                </Badge>
              </div>
              <Progress value={elasticity.drift * 100} />
              {elasticity.drift > 0.3 && (
                <div className="flex items-center gap-2 mt-2 text-sm text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span>High drift detected - review trust factors</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {elasticity.signals && elasticity.signals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Trust Signals</CardTitle>
            <CardDescription>Recent trust-affecting events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {elasticity.signals.map((signal, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 border rounded">
                  <div>
                    <span className="font-medium">{signal.type}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {new Date(signal.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <Badge>{(signal.impact * 100).toFixed(1)}%</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

