'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw, Download, Anchor, AlertTriangle, TrendingDown } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function RiskDiffusionPage() {
  const [diffusion, setDiffusion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState('');

  useEffect(() => {
    if (orgId) {
      loadDiffusion();
    }
  }, [orgId]);

  const loadDiffusion = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/risk-diffusion/${orgId}`);
      if (!res.ok) throw new Error('Failed to load diffusion');
      const data = await res.json();
      setDiffusion(data.diffusion);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/risk-diffusion/${orgId}/anchor`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to anchor');
      await loadDiffusion();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading && !diffusion) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Credential Risk Diffusion Matrix</h1>
          <p className="text-muted-foreground">
            A 30-axis matrix modeling how employer behavior spreads risk across clinicians, units, specialties & systems
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Organization ID"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="px-3 py-2 border rounded"
          />
          <Button variant="outline" onClick={loadDiffusion} disabled={!orgId}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Load
          </Button>
          <Button variant="outline" onClick={handleAnchor} disabled={!orgId}>
            <Anchor className="h-4 w-4 mr-2" />
            Anchor
          </Button>
        </div>
      </div>

      {diffusion && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Overall Diffusion Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-red-600">
                  {Math.round(diffusion.dimensions?.Overall || 0)}
                </div>
                <p className="text-muted-foreground mt-2">Resilience Score</p>
                <div className="mt-4">
                  <Badge variant={diffusion.resilienceScore >= 75 ? 'default' : diffusion.resilienceScore >= 50 ? 'secondary' : 'destructive'}>
                    {diffusion.resilienceScore >= 75 ? 'High' : diffusion.resilienceScore >= 50 ? 'Medium' : 'Low'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Risk Flow Direction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">
                  {diffusion.dimensions?.RiskFlowDirection > 0 ? 'Inward' : diffusion.dimensions?.RiskFlowDirection < 0 ? 'Outward' : 'Balanced'}
                </div>
                <p className="text-muted-foreground mt-2">Direction: {diffusion.dimensions?.RiskFlowDirection?.toFixed(2)}</p>
                <div className="mt-4">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Diffusion Stability</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">
                  {Math.round(diffusion.dimensions?.DiffusionStability || 0)}
                </div>
                <p className="text-muted-foreground mt-2">Volatility Coupling</p>
                <div className="mt-4">
                  <Badge variant="outline">
                    {Math.round(diffusion.dimensions?.VolatilityDiffusionCoupling || 0)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>30-Axis Diffusion Dimensions</CardTitle>
              <CardDescription>Complete diffusion tensor breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {diffusion.layers?.map((layer: any) => (
                  <div key={layer.dimension} className="p-3 border rounded">
                    <div className="text-sm font-medium">{layer.dimension}</div>
                    <div className={`text-2xl font-bold mt-1 ${layer.value > 20 ? 'text-red-600' : layer.value > 10 ? 'text-orange-600' : 'text-green-600'}`}>
                      {Math.round(layer.value)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Confidence: {Math.round(layer.confidence)}%
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {diffusion.hotspots && diffusion.hotspots.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Risk Hotspots
                </CardTitle>
                <CardDescription>Identified employer units causing concentrated diffusion</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {diffusion.hotspots.map((hotspot: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{hotspot.unit}</div>
                          <div className="text-sm text-muted-foreground">{hotspot.description}</div>
                        </div>
                        <Badge variant={hotspot.riskLevel === 'critical' ? 'destructive' : hotspot.riskLevel === 'high' ? 'secondary' : 'outline'}>
                          {hotspot.riskLevel}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {diffusion.predictions && (
            <Card>
              <CardHeader>
                <CardTitle>Diffusion Forecast</CardTitle>
                <CardDescription>Stability and volatility predictions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-lg font-medium">
                    Stability: {Math.round(diffusion.predictions.stability)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Volatility: {Math.round(diffusion.predictions.volatility)}%
                  </div>
                  <div className="mt-4">
                    <div className="text-sm font-medium mb-2">Trajectory</div>
                    {diffusion.predictions.trajectory?.map((t: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 border rounded mb-1">
                        <span>{new Date(t.date).toLocaleDateString()}</span>
                        <div className="flex gap-4">
                          <span>Stability: {Math.round(t.stability)}%</span>
                          <span className="text-red-600">Risk: {Math.round(t.risk)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}








