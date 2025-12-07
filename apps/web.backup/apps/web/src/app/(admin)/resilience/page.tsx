'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, TrendingDown, TrendingUp, MapPin, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function WorkforceResiliencePage() {
  const [resilience, setResilience] = useState<any>(null);
  const [shocks, setShocks] = useState<any[]>([]);
  const [pressure, setPressure] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch shock predictions
      const shocksRes = await fetch(`${API_BASE}/api/workforce-resilience/shocks/predict`);
      if (shocksRes.ok) {
        const shocksData = await shocksRes.json();
        setShocks(shocksData.predictions || []);
      }

      // Fetch pressure scores for key regions
      const regions = ['US-West', 'US-East', 'US-South', 'US-Midwest'];
      const pressurePromises = regions.map(async (region) => {
        const res = await fetch(`${API_BASE}/api/workforce-resilience/pressure/${region}`);
        if (res.ok) {
          const data = await res.json();
          return [region, data.score];
        }
        return [region, 0];
      });
      const pressureResults = await Promise.all(pressurePromises);
      const pressureMap: Record<string, number> = {};
      pressureResults.forEach(([region, score]) => {
        pressureMap[region as string] = score as number;
      });
      setPressure(pressureMap);
    } catch (error) {
      console.error('Failed to fetch resilience data', error);
    } finally {
      setLoading(false);
    }
  };

  const getPressureColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workforce Resilience Engine</h1>
          <p className="text-muted-foreground mt-2">
            Predict shocks, shortages, staffing failures & clinician relocation dynamics
          </p>
        </div>
      </div>

      {/* Shock Predictions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Systemic Shock Predictions
          </CardTitle>
          <CardDescription>Early signals of staffing crises</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {shocks.map((shock, idx) => (
              <div key={idx} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span className="font-semibold">{shock.region}</span>
                    <Badge variant="outline">{shock.specialty}</Badge>
                  </div>
                  <Badge variant={shock.probability > 0.7 ? 'destructive' : 'secondary'}>
                    {(shock.probability * 100).toFixed(0)}% probability
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Severity: {shock.severity}/10 | Timeframe: {shock.timeframe}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Resilience Pressure Scores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Regional Resilience Pressure
          </CardTitle>
          <CardDescription>Resilience scores per region (0-100)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(pressure).map(([region, score]) => (
              <div key={region}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{region}</span>
                  <span className={getPressureColor(score)}>{score}/100</span>
                </div>
                <Progress value={score} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        <Button onClick={fetchData}>Refresh Data</Button>
        <Button variant="outline" onClick={() => window.location.href = '/admin/resilience/improvements'}>
          View Improvement Suggestions
        </Button>
      </div>
    </div>
  );
}








