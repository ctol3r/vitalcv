'use client';

import { useEffect, useState } from 'react';
import { Activity, ArrowRight, RefreshCcw, TrendingUp } from 'lucide-react';
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
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

interface PropagationAnalytics {
  totalPropagations: number;
  successRate: number;
  avgTimeToPropagate: number;
}

export default function PrivilegePropagationPage() {
  const [analytics, setAnalytics] = useState<PropagationAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/privilege-propagation/analytics`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Admin · Privilege Propagation</Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Privilege Propagation</h1>
            <p className="text-muted-foreground">
              Cross-system privilege propagation analytics and management
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-auto gap-2"
            onClick={loadAnalytics}
            disabled={loading}
          >
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </header>

      {analytics && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Total Propagations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{analytics.totalPropagations}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-3xl font-semibold">
                  {(analytics.successRate * 100).toFixed(1)}%
                </div>
                <Progress value={analytics.successRate * 100} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Avg. Time to Propagate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">
                {analytics.avgTimeToPropagate.toFixed(2)}s
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Propagation Flow</CardTitle>
          <CardDescription>Visualize privilege propagation across systems</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4 py-8 text-muted-foreground">
            <div className="rounded-lg border p-4">System A</div>
            <ArrowRight className="h-6 w-6" />
            <div className="rounded-lg border p-4">System B</div>
            <ArrowRight className="h-6 w-6" />
            <div className="rounded-lg border p-4">System C</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

