'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PredictiveFlow {
  region: string;
  signals: Array<{
    type: string;
    value: number;
  }>;
  predictions: {
    movements: Array<{
      from: string;
      to: string;
      probability: number;
      specialty: string;
    }>;
    divergence?: {
      detected: boolean;
      patterns: string[];
    };
    harmonization?: Array<{
      action: string;
      impact: number;
      priority: number;
    }>;
    clusters?: Array<{
      profile: string;
      clinicians: number;
      movement: string;
    }>;
  };
}

export default function PredictiveFlowPage() {
  const [flow, setFlow] = useState<PredictiveFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState('US');

  const fetchFlow = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/predictive-flow/${region}`);
      const data = await res.json();
      setFlow(data);
    } catch (error) {
      console.error('Failed to fetch predictive flow:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlow();
  }, [region]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Workforce Predictive Flow Model</h1>
        <p className="text-muted-foreground mt-2">
          Model future talent flows across specialties, regions, employers & regulatory environments
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Region</CardTitle>
          <CardDescription>Select region to analyze predictive flow</CardDescription>
        </CardHeader>
        <CardContent>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="US">United States</option>
            <option value="EU">European Union</option>
            <option value="CA">Canada</option>
          </select>
        </CardContent>
      </Card>

      {loading && <div className="text-center py-8">Loading...</div>}

      {flow && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Flow Signals</CardTitle>
              <CardDescription>Signals contributing to flow predictions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {flow.signals.map((signal, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="capitalize">{signal.type.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <Badge variant="outline">{(signal.value * 100).toFixed(0)}%</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Predicted Movements</CardTitle>
              <CardDescription>{flow.predictions.movements.length} predicted movements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {flow.predictions.movements.map((movement, idx) => (
                  <div key={idx} className="p-3 border rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-semibold">{movement.from}</span>
                        <span className="mx-2">→</span>
                        <span className="font-semibold">{movement.to}</span>
                      </div>
                      <Badge variant="outline">
                        {(movement.probability * 100).toFixed(0)}% probability
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Specialty: {movement.specialty}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {flow.predictions.divergence?.detected && (
            <Alert>
              <AlertDescription>
                <div className="font-semibold mb-2">Divergence Detected</div>
                <ul className="list-disc list-inside space-y-1">
                  {flow.predictions.divergence.patterns.map((pattern, idx) => (
                    <li key={idx}>{pattern}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {flow.predictions.harmonization && flow.predictions.harmonization.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Harmonization Actions</CardTitle>
                <CardDescription>Suggested actions to stabilize talent flows</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {flow.predictions.harmonization.map((action, idx) => (
                    <div key={idx} className="p-3 border rounded-md">
                      <div className="font-semibold">{action.action}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">Impact: {(action.impact * 100).toFixed(0)}%</Badge>
                        <Badge variant="outline">Priority: {action.priority}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {flow.predictions.clusters && flow.predictions.clusters.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Flow Clusters</CardTitle>
                <CardDescription>Similar workforce movement profiles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {flow.predictions.clusters.map((cluster, idx) => (
                    <div key={idx} className="p-3 border rounded-md">
                      <div className="font-semibold">{cluster.profile}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {cluster.clinicians} clinicians - {cluster.movement}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

