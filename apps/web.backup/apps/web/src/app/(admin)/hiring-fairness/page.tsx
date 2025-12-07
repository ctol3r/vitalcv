'use client';

import { useEffect, useState } from 'react';
import { Scale, AlertTriangle, RefreshCcw, Download, Anchor } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

interface BiasSignal {
  type: string;
  severity: string;
  pattern: string;
  affectedGroups: string[];
}

interface FairnessData {
  orgId: string;
  biasSignals: BiasSignal[];
  fairnessScore: number;
  corrections: Array<{ action: string; priority: string }>;
}

export default function HiringFairnessPage() {
  const [fairness, setFairness] = useState<FairnessData | null>(null);
  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadFairness(id: string) {
    if (!id) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/fairness/${id}`);
      if (response.ok) {
        const data = await response.json();
        setFairness(data);
      }
    } catch (error) {
      console.error('Failed to load fairness data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnchor(id: string) {
    try {
      const response = await fetch(`${API_BASE}/api/fairness/${id}/anchor`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        alert(`Anchored! TX: ${data.txHash}`);
      }
    } catch (error) {
      console.error('Failed to anchor:', error);
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Hiring Fairness Core</h1>
          <p className="text-muted-foreground mt-2">
            AI-driven fairness, transparency, and bias detection
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Load Fairness Data</CardTitle>
          <CardDescription>Enter an organization ID to view fairness metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="text"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="Organization ID"
              className="flex-1 px-3 py-2 border rounded-md"
            />
            <Button onClick={() => loadFairness(orgId)} disabled={loading}>
              {loading ? <RefreshCcw className="h-4 w-4 animate-spin" /> : 'Load'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {fairness && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Fairness Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{fairness.fairnessScore.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {fairness.fairnessScore > 0.7 ? 'Good' : fairness.fairnessScore > 0.4 ? 'Fair' : 'Poor'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Bias Signals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{fairness.biasSignals.length}</div>
                <div className="text-sm text-muted-foreground mt-1">Detected</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Corrections</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{fairness.corrections.length}</div>
                <div className="text-sm text-muted-foreground mt-1">Recommended</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Bias Signals</CardTitle>
                  <CardDescription>Detected patterns in candidate acceptance/rejection</CardDescription>
                </div>
                <Button onClick={() => handleAnchor(fairness.orgId)} variant="outline" size="sm">
                  <Anchor className="h-4 w-4 mr-2" />
                  Anchor
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {fairness.biasSignals.map((signal, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg">
                    <AlertTriangle
                      className={cn(
                        'h-4 w-4',
                        signal.severity === 'high' ? 'text-red-500' : 'text-yellow-500'
                      )}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{signal.type}</div>
                      <div className="text-sm text-muted-foreground">{signal.pattern}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Affected: {signal.affectedGroups.join(', ')}
                      </div>
                    </div>
                    <Badge variant={signal.severity === 'high' ? 'destructive' : 'secondary'}>
                      {signal.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fairness Corrections</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {fairness.corrections.map((correction, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Scale className="h-4 w-4 text-blue-500" />
                    <div className="flex-1">
                      <div className="font-medium">{correction.action}</div>
                    </div>
                    <Badge variant={correction.priority === 'high' ? 'destructive' : 'secondary'}>
                      {correction.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

