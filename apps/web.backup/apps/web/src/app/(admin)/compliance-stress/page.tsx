'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, TrendingDown, RefreshCcw, Download, Anchor } from 'lucide-react';
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

interface StressScenario {
  name: string;
  employerCount: number;
  results: {
    resilience: number;
    bottlenecks: Array<{ component: string; severity: string }>;
    failures: Array<{ type: string; count: number }>;
  };
}

interface StressData {
  scenarios: StressScenario[];
  overallResilience: number;
  weakestComponents: Array<{ component: string; score: number }>;
  recommendations: Array<{ action: string; priority: string }>;
}

export default function ComplianceStressPage() {
  const [stress, setStress] = useState<StressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStress();
  }, []);

  async function loadStress() {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/compliance/stress`);
      if (response.ok) {
        const data = await response.json();
        setStress(data);
      }
    } catch (error) {
      console.error('Failed to load stress data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnchor() {
    try {
      const response = await fetch(`${API_BASE}/api/compliance/stress/anchor`, {
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
          <h1 className="text-3xl font-bold">Compliance Stress Engine</h1>
          <p className="text-muted-foreground mt-2">
            Simulate compliance resilience under stress
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadStress} variant="outline" disabled={loading}>
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          {stress && (
            <Button onClick={handleAnchor} variant="outline">
              <Anchor className="h-4 w-4 mr-2" />
              Anchor
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <RefreshCcw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          </CardContent>
        </Card>
      ) : stress ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Overall Resilience</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stress.overallResilience.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {stress.overallResilience > 0.7 ? 'High' : stress.overallResilience > 0.4 ? 'Medium' : 'Low'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Scenarios</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stress.scenarios.length}</div>
                <div className="text-sm text-muted-foreground mt-1">Test scenarios</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Weak Components</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stress.weakestComponents.length}</div>
                <div className="text-sm text-muted-foreground mt-1">Identified</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Stress Scenarios</CardTitle>
              <CardDescription>Compliance resilience under various stress conditions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stress.scenarios.map((scenario, idx) => (
                  <div key={idx} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-medium">{scenario.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {scenario.employerCount} employers
                        </div>
                      </div>
                      <Badge
                        variant={
                          scenario.results.resilience > 0.7
                            ? 'default'
                            : scenario.results.resilience > 0.4
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {scenario.results.resilience.toFixed(2)}
                      </Badge>
                    </div>
                    {scenario.results.bottlenecks.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {scenario.results.bottlenecks.map((bottleneck, bIdx) => (
                          <Badge key={bIdx} variant="outline" className="mr-2">
                            {bottleneck.component} ({bottleneck.severity})
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stress.recommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg">
                    <AlertTriangle
                      className={cn(
                        'h-4 w-4',
                        rec.priority === 'high' ? 'text-red-500' : 'text-yellow-500'
                      )}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{rec.action}</div>
                    </div>
                    <Badge variant={rec.priority === 'high' ? 'destructive' : 'secondary'}>
                      {rec.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No stress data available
          </CardContent>
        </Card>
      )}
    </div>
  );
}

