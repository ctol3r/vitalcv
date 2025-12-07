'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  MapPin,
  Users,
  Building2,
  Sparkles,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

export default function MarketInsightsPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="container mx-auto max-w-7xl space-y-6 py-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Market Insights</h1>
        <p className="text-muted-foreground">
          Enterprise intelligence and market analytics for health systems
        </p>
      </header>

      {/* Heatmap: Demand vs Supply by Specialty */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Demand vs Supply by Specialty
          </CardTitle>
          <CardDescription>Heatmap showing market dynamics</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="space-y-4">
              {[
                { specialty: 'Internal Medicine', demand: 85, supply: 72, ratio: 1.18 },
                { specialty: 'Emergency Medicine', demand: 92, supply: 68, ratio: 1.35 },
                { specialty: 'Critical Care', demand: 78, supply: 45, ratio: 1.73 },
                { specialty: 'Psychiatry', demand: 65, supply: 58, ratio: 1.12 },
              ].map((item) => (
                <div key={item.specialty} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.specialty}</span>
                    <span className="text-muted-foreground">
                      Ratio: {item.ratio.toFixed(2)} (Demand/Supply)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Demand</span>
                        <span>{item.demand}%</span>
                      </div>
                      <Progress value={item.demand} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Supply</span>
                        <span>{item.supply}%</span>
                      </div>
                      <Progress value={item.supply} className="h-2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trust Score Trend Map */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Trust Score Trend Map
          </CardTitle>
          <CardDescription>Average trust scores across states</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {[
                { state: 'CA', score: 0.88, trend: 'up' },
                { state: 'NY', score: 0.85, trend: 'stable' },
                { state: 'TX', score: 0.82, trend: 'up' },
                { state: 'FL', score: 0.79, trend: 'down' },
              ].map((item) => (
                <div key={item.state} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{item.state}</span>
                    <Badge
                      variant={
                        item.trend === 'up'
                          ? 'default'
                          : item.trend === 'stable'
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      <TrendingUp className="h-3 w-3" />
                    </Badge>
                  </div>
                  <Progress value={item.score * 100} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {(item.score * 100).toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compact Advantage Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Compact Advantage Summary
          </CardTitle>
          <CardDescription>Most portable clinicians by state</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-emerald-50">
                <div>
                  <p className="font-semibold">California</p>
                  <p className="text-sm text-muted-foreground">
                    Most portable clinicians live in CA
                  </p>
                </div>
                <Badge variant="default">45% of compact-eligible</Badge>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {['New York', 'Texas', 'Florida'].map((state) => (
                  <div key={state} className="p-3 rounded-lg border">
                    <p className="font-medium text-sm">{state}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.floor(Math.random() * 20 + 10)}% portable
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Predictive Staffing Shortages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Predictive Staffing Shortages
          </CardTitle>
          <CardDescription>Forecasted shortages in next 90 days</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="space-y-3">
              {[
                { specialty: 'Critical Care', risk: 'high', days: 45 },
                { specialty: 'Emergency Medicine', risk: 'medium', days: 60 },
                { specialty: 'Psychiatry', risk: 'low', days: 90 },
              ].map((item) => (
                <div key={item.specialty} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{item.specialty}</p>
                    <p className="text-sm text-muted-foreground">
                      Projected in {item.days} days
                    </p>
                  </div>
                  <Badge
                    variant={
                      item.risk === 'high'
                        ? 'destructive'
                        : item.risk === 'medium'
                        ? 'secondary'
                        : 'outline'
                    }
                  >
                    {item.risk} risk
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Facility Competitiveness Index */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Facility Competitiveness Index
          </CardTitle>
          <CardDescription>How competitive facilities are in attracting talent</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="space-y-3">
              {[
                { facility: 'Metro General', score: 0.92, rank: 1 },
                { facility: 'City Hospital', score: 0.88, rank: 2 },
                { facility: 'Regional Medical', score: 0.85, rank: 3 },
              ].map((item) => (
                <div key={item.facility} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{item.facility}</span>
                    <Badge>#{item.rank}</Badge>
                  </div>
                  <Progress value={item.score * 100} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Competitiveness: {(item.score * 100).toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Talent Velocity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Talent Velocity Score
          </CardTitle>
          <CardDescription>How fast clinicians onboard (average days)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="space-y-3">
              {[
                { specialty: 'Internal Medicine', days: 14, velocity: 'fast' },
                { specialty: 'Emergency Medicine', days: 21, velocity: 'medium' },
                { specialty: 'Critical Care', days: 28, velocity: 'slow' },
              ].map((item) => (
                <div key={item.specialty} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{item.specialty}</span>
                    <Badge
                      variant={
                        item.velocity === 'fast'
                          ? 'default'
                          : item.velocity === 'medium'
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {item.days} days
                    </Badge>
                  </div>
                  <Progress
                    value={((30 - item.days) / 30) * 100}
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

