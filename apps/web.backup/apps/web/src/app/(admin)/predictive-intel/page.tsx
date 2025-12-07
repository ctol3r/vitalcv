'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Brain, TrendingUp, AlertTriangle, Target } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function PredictiveIntelPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/predictive-intel`);
      if (res.ok) {
        const intelData = await res.json();
        setData(intelData);
      }
    } catch (error) {
      console.error('Failed to load predictive intelligence:', error);
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

  const intel = data?.intel || {};
  const shortages = intel.shortages || [];
  const churn = intel.churn || [];
  const opportunities = intel.opportunities || [];
  const performance = intel.performance || [];
  const migrations = intel.migrations || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workforce Predictive Intelligence</h1>
          <p className="text-muted-foreground mt-2">
            Shortages, churn, risk, performance, growth & opportunity predictions
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Shortages</CardTitle>
            <CardDescription>Predicted gaps</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{shortages.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Churn Risks</CardTitle>
            <CardDescription>At-risk clinicians</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{churn.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Opportunities</CardTitle>
            <CardDescription>Forecasted openings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{opportunities.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance</CardTitle>
            <CardDescription>Forecasts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{performance.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Migrations</CardTitle>
            <CardDescription>Specialty switches</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{migrations.length}</div>
          </CardContent>
        </Card>
      </div>

      {shortages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Predicted Shortages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {shortages.slice(0, 5).map((shortage: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="font-medium">
                      {shortage.specialty} - {shortage.region}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Gap: {shortage.projectedGap} | {shortage.timeframe}
                    </div>
                  </div>
                  <Badge
                    variant={
                      shortage.severity === 'critical'
                        ? 'destructive'
                        : shortage.severity === 'high'
                        ? 'secondary'
                        : 'default'
                    }
                  >
                    {shortage.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {churn.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Churn Risk Predictions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {churn.slice(0, 5).map((risk: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="font-medium">Clinician {risk.clinicianId}</div>
                    <div className="text-sm text-muted-foreground">
                      Risk: {(risk.riskScore * 100).toFixed(0)}%
                    </div>
                  </div>
                  <Badge variant={risk.riskScore > 0.5 ? 'destructive' : 'default'}>
                    {(risk.riskScore * 100).toFixed(0)}% risk
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {opportunities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Job Opportunity Forecasts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {opportunities.slice(0, 5).map((opp: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="font-medium">
                      {opp.specialty} - {opp.region}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {opp.openings} openings | {opp.timeframe}
                    </div>
                  </div>
                  <Badge>Growth: {(opp.growthRate * 100).toFixed(0)}%</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

