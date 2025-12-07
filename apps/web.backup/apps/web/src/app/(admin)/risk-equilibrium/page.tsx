'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function RiskEquilibriumPage() {
  const [region, setRegion] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const fetchEquilibrium = async () => {
    if (!region.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/risk-equilibrium/${region}`);
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-8 w-8" />
          Workforce Risk Equilibrium
        </h1>
        <p className="text-muted-foreground mt-2">
          Model and stabilize workforce risk across talent supply, safety, burnout, and employer volatility
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Risk Equilibrium Analysis</CardTitle>
          <CardDescription>Enter region to analyze risk equilibrium</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Region (e.g., US, EU, APAC)"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchEquilibrium()}
            />
            <Button onClick={fetchEquilibrium} disabled={loading || !region.trim()}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Analyze
            </Button>
          </div>

          {data && data.equilibrium && (
            <Card>
              <CardHeader>
                <CardTitle>Equilibrium Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-3xl font-bold">{data.equilibrium.equilibriumScore}/100</div>
                  <Progress value={data.equilibrium.equilibriumScore} />
                  <Badge variant={data.equilibrium.balanced ? 'default' : 'destructive'}>
                    {data.equilibrium.balanced ? 'Balanced' : 'Unbalanced'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

