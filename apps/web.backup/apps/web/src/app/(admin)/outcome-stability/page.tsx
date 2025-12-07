'use client';

import { useCallback, useEffect, useState } from 'react';
import { TrendingUp, AlertTriangle, Target, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRoleUX } from '@/contexts/RoleUXContext';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

export default function OutcomeStabilityPage() {
  const { formatError } = useRoleUX();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stabilityData, setStabilityData] = useState<any>(null);
  const [filters, setFilters] = useState({ clinicianId: '', orgId: '', region: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.clinicianId) params.append('clinicianId', filters.clinicianId);
      if (filters.orgId) params.append('orgId', filters.orgId);
      if (filters.region) params.append('region', filters.region);

      const response = await fetch(`${API_BASE}/api/outcome-stability?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Stability API failed (${response.status})`);
      }
      const payload = await response.json();
      setStabilityData(payload);
    } catch (err) {
      console.error('[admin][outcome-stability] load failed', err);
      setError(formatError('stability_fetch_failed', err instanceof Error ? err.message : 'Unable to load stability'));
    } finally {
      setLoading(false);
    }
  }, [filters, formatError]);

  const anchorSnapshot = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/outcome-stability/anchor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      });
      if (!response.ok) throw new Error('Anchor failed');
      await load();
    } catch (err) {
      console.error('[admin][outcome-stability] anchor failed', err);
    }
  }, [filters, load]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !stabilityData) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Workforce Outcome Stability Engine v9</CardTitle>
            <CardDescription>Loading stability data...</CardDescription>
          </CardHeader>
        </Card>
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
                <BarChart3 className="h-5 w-5" />
                Workforce Outcome Stability Engine v9
              </CardTitle>
              <CardDescription>
                30-axis stability engine predicting success, retention, safety, performance, burnout & compliance outcomes
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Clinician ID"
                value={filters.clinicianId}
                onChange={(e) => setFilters({ ...filters, clinicianId: e.target.value })}
                className="px-3 py-2 border rounded"
              />
              <input
                type="text"
                placeholder="Org ID"
                value={filters.orgId}
                onChange={(e) => setFilters({ ...filters, orgId: e.target.value })}
                className="px-3 py-2 border rounded"
              />
              <input
                type="text"
                placeholder="Region"
                value={filters.region}
                onChange={(e) => setFilters({ ...filters, region: e.target.value })}
                className="px-3 py-2 border rounded"
              />
              <Button onClick={load}>Load</Button>
              <Button onClick={anchorSnapshot} disabled={loading}>
                Anchor
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded">
              {error}
            </div>
          )}

          {stabilityData && (
            <div className="space-y-6">
              {/* Risk Blend */}
              {stabilityData.riskBlend && (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Overall Stability</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stabilityData.riskBlend.overall || 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stabilityData.riskBlend.performance || 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Burnout</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stabilityData.riskBlend.burnout || 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Regulatory</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stabilityData.riskBlend.regulatory || 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Trust</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stabilityData.riskBlend.trust || 0}</div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Tensor Metrics */}
              {stabilityData.tensor && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Retention Stability
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>30 days:</span>
                          <Badge>{stabilityData.tensor.retention?.day30 || 0}%</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>90 days:</span>
                          <Badge>{stabilityData.tensor.retention?.day90 || 0}%</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>180 days:</span>
                          <Badge>{stabilityData.tensor.retention?.day180 || 0}%</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>365 days:</span>
                          <Badge>{stabilityData.tensor.retention?.day365 || 0}%</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Performance & Safety
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Predicted Performance:</span>
                          <Badge>{stabilityData.tensor.performance?.predicted || 0}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Safety Score:</span>
                          <Badge>{stabilityData.tensor.safety?.score || 0}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Safety Correlation:</span>
                          <span>{stabilityData.tensor.safety?.correlation || 0}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Burnout & Risk
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Burnout Risk:</span>
                          <Badge variant={stabilityData.tensor.burnout?.risk > 60 ? 'destructive' : 'default'}>
                            {stabilityData.tensor.burnout?.risk || 0}%
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Burnout Coupling:</span>
                          <span>{stabilityData.tensor.burnout?.coupling || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Failure Probability:</span>
                          <Badge variant={stabilityData.tensor.failure?.probability > 50 ? 'destructive' : 'default'}>
                            {stabilityData.tensor.failure?.probability || 0}%
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Long-Term Stability</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>12 months:</span>
                          <Badge>{stabilityData.tensor.longTerm?.month12 || 0}%</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>24 months:</span>
                          <Badge>{stabilityData.tensor.longTerm?.month24 || 0}%</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>36 months:</span>
                          <Badge>{stabilityData.tensor.longTerm?.month36 || 0}%</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Prescriptions */}
              {stabilityData.prescriptions && stabilityData.prescriptions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Stabilization Prescriptions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {stabilityData.prescriptions.map((prescription: any, idx: number) => (
                        <div key={idx} className="p-3 bg-muted rounded">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{prescription.intervention}</span>
                            <Badge variant={prescription.priority === 'high' ? 'destructive' : 'default'}>
                              {prescription.priority}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Target: {prescription.target}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Expected: {prescription.expectedOutcome}
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








