'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw, Download, Anchor, TrendingUp, TrendingDown } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function ConvergencePage() {
  const [convergence, setConvergence] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clinicianId, setClinicianId] = useState('');

  useEffect(() => {
    if (clinicianId) {
      loadConvergence();
    }
  }, [clinicianId]);

  const loadConvergence = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/convergence/${clinicianId}`);
      if (!res.ok) throw new Error('Failed to load convergence');
      const data = await res.json();
      setConvergence(data.convergence);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/convergence/${clinicianId}/anchor`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to anchor');
      await loadConvergence();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading && !convergence) {
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
          <h1 className="text-3xl font-bold">Trust-Performance Convergence</h1>
          <p className="text-muted-foreground">
            A 30-axis engine unifying trust, performance, compliance, competency, readiness & safety
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Clinician ID"
            value={clinicianId}
            onChange={(e) => setClinicianId(e.target.value)}
            className="px-3 py-2 border rounded"
          />
          <Button variant="outline" onClick={loadConvergence} disabled={!clinicianId}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Load
          </Button>
          <Button variant="outline" onClick={handleAnchor} disabled={!clinicianId}>
            <Anchor className="h-4 w-4 mr-2" />
            Anchor
          </Button>
        </div>
      </div>

      {convergence && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Overall Convergence</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">
                  {Math.round(convergence.dimensions?.Overall || 0)}
                </div>
                <p className="text-muted-foreground mt-2">Health Score</p>
                <div className="mt-4">
                  <Badge variant={convergence.healthScore >= 75 ? 'default' : convergence.healthScore >= 50 ? 'secondary' : 'destructive'}>
                    {convergence.healthScore >= 75 ? 'High' : convergence.healthScore >= 50 ? 'Medium' : 'Low'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Trust Stability</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">
                  {Math.round(convergence.dimensions?.TrustStability || 0)}
                </div>
                <p className="text-muted-foreground mt-2">Trust-Performance Alignment</p>
                <div className="mt-4">
                  {convergence.dimensions?.TrustPerformanceAlignment >= 75 ? (
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Reliability</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">
                  {Math.round(convergence.dimensions?.PerformanceReliability || 0)}
                </div>
                <p className="text-muted-foreground mt-2">Outcome Coherence</p>
                <div className="mt-4">
                  <Badge variant="outline">
                    {Math.round(convergence.dimensions?.OutcomeCoherence || 0)}%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>30-Axis Convergence Dimensions</CardTitle>
              <CardDescription>Complete convergence tensor breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {convergence.layers?.map((layer: any) => (
                  <div key={layer.dimension} className="p-3 border rounded">
                    <div className="text-sm font-medium">{layer.dimension}</div>
                    <div className="text-2xl font-bold mt-1">{Math.round(layer.value)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Confidence: {Math.round(layer.confidence)}%
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {convergence.deviations && convergence.deviations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Convergence Deviations</CardTitle>
                <CardDescription>Detected divergence between trust and performance paths</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {convergence.deviations.map((dev: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{dev.dimension}</div>
                          <div className="text-sm text-muted-foreground">{dev.description}</div>
                        </div>
                        <Badge variant={dev.severity === 'high' ? 'destructive' : dev.severity === 'medium' ? 'secondary' : 'outline'}>
                          {dev.severity}
                        </Badge>
                      </div>
                      <div className="mt-2 text-sm">{dev.suggestedAction}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {convergence.predictions && (
            <Card>
              <CardHeader>
                <CardTitle>Convergence Forecast</CardTitle>
                <CardDescription>ML-powered trajectory prediction</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-lg font-medium">
                    Forecast: {Math.round(convergence.predictions.convergenceForecast)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Drift Risk: {Math.round(convergence.predictions.driftRisk)}%
                  </div>
                  <div className="mt-4">
                    <div className="text-sm font-medium mb-2">Trajectory</div>
                    {convergence.predictions.trajectory?.map((t: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 border rounded mb-1">
                        <span>{new Date(t.date).toLocaleDateString()}</span>
                        <span className="font-bold">{Math.round(t.score)}%</span>
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








