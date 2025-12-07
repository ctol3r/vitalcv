'use client';

import { DollarSign, TrendingUp, Users, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

interface EconomicImpact {
  costSavings: number;
  timeSavings: number;
  roi: number;
  efficiency: number;
}

interface ShortageCost {
  specialty: string;
  region: string;
  dailyCost: number;
  totalCost: number;
}

interface EconomicFabric {
  impact: EconomicImpact;
  shortages: ShortageCost[];
  migration: {
    netImpact: number;
    trends: Array<{ date: string; impact: number }>;
  };
  systemProjections: Array<{
    systemId: string;
    projectedSavings: number;
  }>;
}

export default function EconomicIntelPage() {
  const [fabric, setFabric] = useState<EconomicFabric | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFabric();
  }, []);

  async function fetchFabric() {
    try {
      // Get region from query params or use a default for demo
      const region = 'us-west-2'; // TODO: Get from route params
      const res = await fetch(`${API_BASE}/api/economic-intelligence/${region}`);
      if (res.ok) {
        const data = await res.json();
        // Fetch additional data
        const [shortagesRes, migrationRes] = await Promise.all([
          fetch(`${API_BASE}/api/economic-intelligence/shortage-cost`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ region }),
          }),
          fetch(`${API_BASE}/api/economic-intelligence/migration`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromRegion: region, toRegion: 'us-east-1', clinicianCount: 10 }),
          }),
        ]);

        const shortages = shortagesRes.ok ? await shortagesRes.json() : { costs: [] };
        const migration = migrationRes.ok ? await migrationRes.json() : { netImpact: 0, trends: [] };

        setFabric({
          impact: data.impact || { costSavings: 0, timeSavings: 0, roi: 0, efficiency: 0 },
          shortages: shortages.costs || [],
          migration: {
            netImpact: migration.netImpact || 0,
            trends: migration.trends || [],
          },
          systemProjections: [],
        });
      }
    } catch (error) {
      console.error('Failed to fetch economic intelligence:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!fabric) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Economic Intelligence Fabric</CardTitle>
            <CardDescription>No economic data available</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Workforce Economic Intelligence Fabric</h1>
        <p className="text-muted-foreground mt-2">
          Model macro- and micro-economic effects of workforce behavior, hiring, shortages & credentialing
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Cost Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${fabric.impact.costSavings.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">Total savings</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              ROI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(fabric.impact.roi * 100)}%</div>
            <div className="text-sm text-muted-foreground">Return on investment</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Time Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fabric.impact.timeSavings}</div>
            <div className="text-sm text-muted-foreground">Hours saved</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Efficiency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(fabric.impact.efficiency * 100)}%</div>
            <div className="text-sm text-muted-foreground">Efficiency gain</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Economic Impact</CardTitle>
          <CardDescription>Effects of reduced credentialing time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span>Efficiency</span>
                <span className="text-xl font-semibold">{Math.round(fabric.impact.efficiency * 100)}%</span>
              </div>
              <Progress value={fabric.impact.efficiency * 100} />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Cost Savings: </span>
                <span className="font-medium">${fabric.impact.costSavings.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Time Savings: </span>
                <span className="font-medium">{fabric.impact.timeSavings} hours</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {fabric.shortages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Shortage Costs</CardTitle>
            <CardDescription>Estimated cost of staffing shortages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {fabric.shortages.map((shortage, i) => (
                <div key={i} className="p-3 border rounded">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{shortage.specialty}</span>
                      <div className="text-sm text-muted-foreground">{shortage.region}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">${shortage.totalCost.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">
                        ${shortage.dailyCost.toLocaleString()}/day
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Migration Economics</CardTitle>
          <CardDescription>Economic impact of clinician relocation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">Net Impact</span>
              <Badge variant={fabric.migration.netImpact > 0 ? 'default' : 'destructive'}>
                ${fabric.migration.netImpact.toLocaleString()}
              </Badge>
            </div>
            {fabric.migration.trends.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Trends:</p>
                {fabric.migration.trends.slice(0, 6).map((trend, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {new Date(trend.date).toLocaleDateString()}
                    </span>
                    <span className="font-medium">${trend.impact.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {fabric.systemProjections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>System-Level Projections</CardTitle>
            <CardDescription>Forecast cost savings for entire health systems</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {fabric.systemProjections.map((proj, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded">
                  <span className="font-medium">System {proj.systemId.slice(0, 8)}</span>
                  <Badge variant="default">
                    ${proj.projectedSavings.toLocaleString()}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

