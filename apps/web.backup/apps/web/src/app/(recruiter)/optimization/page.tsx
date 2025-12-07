'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Users, DollarSign, AlertCircle, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

export default function HiringOptimizationPage() {
  const [orgId, setOrgId] = useState('');
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function optimize() {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/hiring-optimization/${orgId}/optimize`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setPlan(data);
      }
    } catch (error) {
      console.error('Failed to optimize:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Recruiter · Hiring Optimization</Badge>
        <div>
          <h1 className="text-3xl font-semibold leading-tight">Autonomous Hiring Optimization Engine</h1>
          <p className="text-muted-foreground">
            AI-powered workforce optimization: who to hire, when, where, and why
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Generate Optimization Plan</CardTitle>
          <CardDescription>Optimize job→candidate matching with ML</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Organization ID"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className="flex-1 rounded-md border px-3 py-2"
            />
            <Button onClick={optimize} disabled={loading || !orgId}>
              <TrendingUp className="h-4 w-4 mr-2" />
              Optimize
            </Button>
          </div>
        </CardContent>
      </Card>

      {plan && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{plan.recommendations?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Candidate matches</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Bottlenecks</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{plan.bottlenecks?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Screening bottlenecks</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Falloff Points</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{plan.falloffPoints?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Drop-off stages</p>
              </CardContent>
            </Card>
          </div>

          {plan.recommendations && plan.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {plan.recommendations.slice(0, 5).map((rec: any, i: number) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-md">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Candidate {rec.candidateId}</p>
                          <p className="text-sm text-muted-foreground">{rec.rationale}</p>
                        </div>
                        <Badge variant="secondary">{(rec.score * 100).toFixed(0)}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

