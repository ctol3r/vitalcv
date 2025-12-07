'use client';

import { useCallback, useState } from 'react';
import { Globe, TrendingUp, AlertTriangle, FileDown, Map } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function MobilityStressPage() {
  const [grid, setGrid] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGrid = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/mobility-stress`);
      if (!response.ok) {
        throw new Error(`Failed to load grid (${response.status})`);
      }
      const data = await response.json();
      setGrid(data);
    } catch (err) {
      console.error('Failed to fetch grid', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const buildGrid = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/mobility-stress/build`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`Failed to build grid (${response.status})`);
      }
      const data = await response.json();
      setGrid(data);
    } catch (err) {
      console.error('Failed to build grid', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const anchorSnapshot = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/mobility-stress/anchor`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to anchor snapshot');
      }
      alert('Mobility stress snapshot anchored successfully');
    } catch (err) {
      console.error('Failed to anchor snapshot', err);
      alert('Failed to anchor snapshot');
    }
  }, []);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">National Mobility Stress Grid</h1>
          <p className="text-muted-foreground">
            Simulate how clinician movement responds to shortages, regulatory shifts & employer demand
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View Mobility Stress Grid</CardTitle>
          <CardDescription>View or build the national mobility stress grid</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={fetchGrid} disabled={loading}>
              View Grid
            </Button>
            <Button onClick={buildGrid} variant="outline" disabled={loading}>
              Build Grid
            </Button>
            <Button onClick={anchorSnapshot} variant="outline">
              <FileDown className="h-4 w-4 mr-2" />
              Anchor
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
            </div>
          )}

          {grid && !loading && (
            <div className="space-y-6">
              {grid.elasticity && grid.elasticity.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Mobility Elasticity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {grid.elasticity.map((item: any, idx: number) => (
                        <div key={idx} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-medium">{item.region} - {item.specialty}</p>
                              <p className="text-sm text-muted-foreground">
                                Predicted Movement: {item.predictedMovement} clinicians
                              </p>
                            </div>
                            <Badge variant="outline">{(item.elasticity * 100).toFixed(0)}%</Badge>
                          </div>
                          <Progress value={item.elasticity * 100} />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {grid.regulatoryShocks && grid.regulatoryShocks.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Regulatory Shocks</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {grid.regulatoryShocks.map((shock: any, idx: number) => (
                        <Alert key={idx} variant="warning">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>{shock.type} - {shock.region}</AlertTitle>
                          <AlertDescription>
                            <p className="mb-1">Impact: {shock.impact}%</p>
                            <p className="mb-1">Affected Specialties: {shock.affectedSpecialties?.join(', ')}</p>
                            <p className="text-sm">{shock.predictedClinicianResponse}</p>
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {grid.crossRegionStress && grid.crossRegionStress.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Cross-Region Stress Diffusion</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {grid.crossRegionStress.map((stress: any, idx: number) => (
                        <div key={idx} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium">{stress.sourceRegion} → {stress.targetRegion}</p>
                            <Badge variant="outline">{(stress.diffusionRate * 100).toFixed(0)}%</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Clinician Flow:</span>
                              <span className="ml-2 font-medium">{stress.clinicianFlow}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Time to Equilibrium:</span>
                              <span className="ml-2 font-medium">{stress.timeToEquilibrium} days</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {grid.correlations && grid.correlations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Stress Correlations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {grid.correlations.map((correlation: any, idx: number) => (
                        <div key={idx} className="p-3 border rounded-lg">
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Risk:</span>
                              <span className="ml-2 font-medium">{correlation.risk}%</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Readiness:</span>
                              <span className="ml-2 font-medium">{correlation.readiness}%</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Mobility:</span>
                              <span className="ml-2 font-medium">{correlation.mobility}%</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Correlation:</span>
                              <span className="ml-2 font-medium">{(correlation.correlation * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

