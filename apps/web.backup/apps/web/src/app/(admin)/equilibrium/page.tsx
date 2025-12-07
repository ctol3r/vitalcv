'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Activity, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function EquilibriumPage() {
  const [loading, setLoading] = useState(true);
  const [equilibrium, setEquilibrium] = useState<any>(null);
  const [region, setRegion] = useState('US-West');

  useEffect(() => {
    loadEquilibrium();
  }, [region]);

  async function loadEquilibrium() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/hiring-equilibrium/${region}`);
      if (res.ok) {
        const data = await res.json();
        setEquilibrium(data.equilibrium);
      }
    } catch (error) {
      console.error('Failed to load equilibrium:', error);
    } finally {
      setLoading(false);
    }
  }

  async function solveEquilibrium() {
    try {
      const res = await fetch(`${API_BASE}/api/hiring-equilibrium/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region }),
      });
      if (res.ok) {
        const data = await res.json();
        setEquilibrium(data);
        await loadEquilibrium();
      }
    } catch (error) {
      console.error('Failed to solve equilibrium:', error);
    }
  }

  if (loading && !equilibrium) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const balance = equilibrium?.balance || 0;
  const elasticity = equilibrium?.elasticity || 0;
  const instability = equilibrium?.instability || 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cross-System Hiring Equilibrium</h1>
          <p className="text-muted-foreground mt-2">
            Balance supply, demand, readiness, trust & incentives across employers and regions
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="px-4 py-2 border rounded"
          >
            <option value="US-West">US-West</option>
            <option value="US-East">US-East</option>
            <option value="US-Central">US-Central</option>
          </select>
          <Button onClick={solveEquilibrium}>
            <Activity className="h-4 w-4 mr-2" />
            Solve Equilibrium
          </Button>
          <Button variant="outline" onClick={loadEquilibrium}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Balance</CardTitle>
            <CardDescription>Supply/Demand balance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {balance > 0 ? '+' : ''}{balance.toFixed(1)}
            </div>
            <div className="flex items-center mt-2">
              {balance > 20 ? (
                <>
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-500">Surplus</span>
                </>
              ) : balance < -20 ? (
                <>
                  <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                  <span className="text-sm text-red-500">Shortage</span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Balanced</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Elasticity</CardTitle>
            <CardDescription>Market responsiveness</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{elasticity.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground mt-2">
              Workforce mobility score
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Instability</CardTitle>
            <CardDescription>Market volatility</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{instability.toFixed(1)}</div>
            <div className="flex items-center mt-2">
              {instability > 70 ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-yellow-500 mr-1" />
                  <span className="text-sm text-yellow-500">High volatility</span>
                </>
              ) : (
                <span className="text-sm text-green-500">Stable</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {equilibrium?.corrections && equilibrium.corrections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tilt Corrections</CardTitle>
            <CardDescription>Suggested rebalancing actions</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {equilibrium.corrections.map((corr: any, idx: number) => (
                <li key={idx} className="flex items-center justify-between p-2 border rounded">
                  <span>{corr.action}</span>
                  <Badge variant="outline">Impact: {corr.impact}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}








