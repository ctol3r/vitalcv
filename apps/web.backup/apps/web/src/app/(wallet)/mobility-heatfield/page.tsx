'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Globe, MapPin, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function MobilityHeatfieldPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const clinicianId = 'demo-clinician-id'; // Replace with actual clinician ID
    fetch(`${API_BASE}/api/mobility/intelligence/${clinicianId}`)
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load mobility intelligence', err);
        setLoading(false);
      });
  }, []);

  const handleAnchor = async () => {
    const clinicianId = 'demo-clinician-id';
    try {
      const res = await fetch(`${API_BASE}/api/mobility/intelligence/${clinicianId}/anchor`, {
        method: 'POST',
      });
      const result = await res.json();
      alert('Mobility intelligence anchored successfully!');
    } catch (err) {
      console.error('Failed to anchor', err);
      alert('Failed to anchor mobility intelligence');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Global Mobility Intelligence Heatfield
              </CardTitle>
              <CardDescription>
                30-axis intelligence core modeling clinician movement, eligibility, readiness, visas, compacts & regulatory pathways
              </CardDescription>
            </div>
            <Button onClick={handleAnchor} variant="outline">
              Anchor Snapshot
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data ? (
            <div className="space-y-6">
              {/* Compact Eligibility */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Compact Eligibility
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.compactEligibility?.map((compact: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{compact.compact}</span>
                        <Badge variant={compact.eligible ? 'default' : 'secondary'}>
                          {compact.eligible ? 'Eligible' : 'Not Eligible'}
                        </Badge>
                      </div>
                      <Progress value={compact.coverage} className="mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Coverage: {compact.coverage}%
                      </p>
                      <div className="mt-2">
                        {compact.rationale?.map((r: string, i: number) => (
                          <Badge key={i} variant="outline" className="mr-1 text-xs">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Multi-Region Readiness */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Multi-Region Readiness
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {data.multiRegionReadiness?.map((region: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{region.region}</span>
                        <Badge>{(region.readinessScore * 100).toFixed(0)}%</Badge>
                      </div>
                      <Progress value={region.readinessScore * 100} className="mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Timeline: {region.timeline} days
                      </p>
                      {region.blockers?.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-destructive">Blockers:</p>
                          {region.blockers.map((blocker: string, i: number) => (
                            <Badge key={i} variant="destructive" className="mr-1 text-xs">
                              {blocker}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Migration Friction */}
              <div>
                <h3 className="font-semibold mb-3">Migration Friction Score</h3>
                <div className="p-4 border rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span>Overall Friction</span>
                    <span className="font-bold text-2xl">{data.migrationFriction?.overallScore}/100</span>
                  </div>
                  <Progress value={100 - data.migrationFriction?.overallScore} className="mb-4" />
                  <div className="space-y-2">
                    {data.migrationFriction?.factors?.map((factor: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="text-sm">{factor.factor}</span>
                        <Badge variant="outline">{factor.impact}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Predictive Migration */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Predictive Migration Vector
                </h3>
                <div className="p-4 border rounded">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Direction</p>
                      <p className="font-bold">{data.predictiveMigration?.direction}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Magnitude</p>
                      <p className="font-bold">{data.predictiveMigration?.magnitude}/100</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Confidence</p>
                      <p className="font-bold">{(data.predictiveMigration?.confidence * 100).toFixed(0)}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Timeframe</p>
                      <p className="font-bold">{data.predictiveMigration?.timeframe} days</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Regional Shortages */}
              <div>
                <h3 className="font-semibold mb-3">Regional Shortages & Opportunities</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.regionalShortages?.map((shortage: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{shortage.region} - {shortage.specialty}</span>
                        <Badge variant="default">Opportunity: {(shortage.opportunityScore * 100).toFixed(0)}%</Badge>
                      </div>
                      <Progress value={shortage.shortageSeverity * 100} className="mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Shortage Severity: {(shortage.shortageSeverity * 100).toFixed(0)}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobility Resilience */}
              <div>
                <h3 className="font-semibold mb-3">Mobility Resilience Classification</h3>
                <div className="p-4 border rounded">
                  <Badge
                    variant={
                      data.resilienceClassification === 'Stable'
                        ? 'default'
                        : data.resilienceClassification === 'Volatile'
                        ? 'secondary'
                        : 'destructive'
                    }
                    className="text-lg px-4 py-2"
                  >
                    {data.resilienceClassification}
                  </Badge>
                </div>
              </div>

              {/* Optimization Plan */}
              <div>
                <h3 className="font-semibold mb-3">Mobility Optimization Plan</h3>
                <div className="space-y-2">
                  {data.optimizationPlan?.map((action: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{action.action}</span>
                        <Badge>Priority: {(action.priority * 100).toFixed(0)}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Impact: </span>
                          <span className="font-medium">{(action.impact * 100).toFixed(0)}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Effort: </span>
                          <span className="font-medium">{(action.effort * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>No mobility intelligence data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








