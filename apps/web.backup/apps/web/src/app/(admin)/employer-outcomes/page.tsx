'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, DollarSign, Target, Shield } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function EmployerOutcomesPage() {
  const [loading, setLoading] = useState(true);
  const [outcomes, setOutcomes] = useState<any>(null);
  const [orgId] = useState('demo-org-1');

  useEffect(() => {
    loadOutcomes();
  }, []);

  async function loadOutcomes() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/employer-outcomes/${orgId}`);
      if (res.ok) {
        const data = await res.json();
        setOutcomes(data);
      }
    } catch (error) {
      console.error('Failed to load employer outcomes:', error);
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
        <h1 className="text-3xl font-bold">Employer Outcome Analytics</h1>
        <p className="text-muted-foreground mt-2">
          Measure employer success, hiring outcomes, safety impacts, and credential ROI
        </p>
      </div>

      {outcomes && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Hire Success
                </CardTitle>
                <CardDescription>Predicted probability</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {(outcomes.hireSuccess?.probability * 100 || 0).toFixed(1)}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  ROI
                </CardTitle>
                <CardDescription>Return on investment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{outcomes.roi?.roi?.toFixed(1) || 0}%</div>
                <div className="text-sm text-muted-foreground mt-2">
                  Savings: ${(outcomes.roi?.costSavings || 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Quality Score
                </CardTitle>
                <CardDescription>Hiring quality</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{outcomes.quality?.score?.toFixed(1) || 0}/100</div>
                <Progress value={outcomes.quality?.score || 0} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Safety Impact
                </CardTitle>
                <CardDescription>Patient safety score</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{outcomes.safety?.score?.toFixed(1) || 0}/100</div>
              </CardContent>
            </Card>
          </div>

          {outcomes.funnel && outcomes.funnel.stages && (
            <Card>
              <CardHeader>
                <CardTitle>Conversion Funnel</CardTitle>
                <CardDescription>Hiring stage analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {outcomes.funnel.stages.map((stage: any, i: number) => (
                    <div key={i} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{stage.stage}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">{stage.count} candidates</span>
                          <Badge variant="secondary">
                            {(stage.conversionRate * 100).toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                      <Progress value={stage.conversionRate * 100} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {outcomes.benchmark && (
            <Card>
              <CardHeader>
                <CardTitle>Benchmark Ranking</CardTitle>
                <CardDescription>Performance vs. other employers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">Rank #{outcomes.benchmark.rank}</div>
                <div className="text-sm text-muted-foreground mt-2">
                  {outcomes.benchmark.percentile}th percentile
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

