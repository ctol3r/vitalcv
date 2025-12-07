'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sparkles, Globe, Shield, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function TrustCosmosPage() {
  const [fieldId, setFieldId] = useState('');
  const [cosmos, setCosmos] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCosmos = useCallback(async () => {
    if (!fieldId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/trust/cosmos/field/${fieldId}`);
      if (!response.ok) {
        throw new Error(`Failed to load cosmos data (${response.status})`);
      }
      const data = await response.json();
      setCosmos(data.result);
    } catch (err) {
      console.error('Failed to fetch cosmos', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [fieldId]);

  const analyzeGravityWells = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/trust/cosmos/gravity-wells`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evidenceClusters: [
            { id: 'cluster1', evidence: [], trustScore: 0.85 },
            { id: 'cluster2', evidence: [], trustScore: 0.72 },
            { id: 'cluster3', evidence: [], trustScore: 0.91 },
          ],
        }),
      });
      if (!response.ok) throw new Error('Failed to analyze gravity wells');
      const data = await response.json();
      setCosmos((prev: any) => ({ ...prev, gravityWells: data.result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-8 w-8" />
            Trust Cosmology Engine
          </h1>
          <p className="text-muted-foreground">
            Truth-field gravity mechanics & universal credential fusion
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            value={fieldId}
            onChange={(e) => setFieldId(e.target.value)}
            placeholder="Field ID"
            className="md:w-64"
          />
          <Button onClick={fetchCosmos} variant="secondary" disabled={loading}>
            Analyze
          </Button>
          <Button onClick={analyzeGravityWells} variant="outline" disabled={loading}>
            Gravity Wells
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && <p className="text-muted-foreground">Analyzing trust cosmology...</p>}

      {cosmos && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Trust Field
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-2">{fieldId}</div>
              <Badge variant="outline">Active</Badge>
            </CardContent>
          </Card>

          {cosmos.trustGravityWells && cosmos.trustGravityWells.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Gravity Wells</CardTitle>
                <CardDescription>{cosmos.trustGravityWells.length} clusters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {cosmos.trustGravityWells.slice(0, 3).map((well: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm">{well.evidenceClusterId}</span>
                    <Badge>{(well.gravity * 100).toFixed(1)}%</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Truth Entropy
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cosmos.truthEntropyVacuum ? (
                <div>
                  <div className="text-2xl font-bold mb-2">
                    {cosmos.truthEntropyVacuum.entropy ? (cosmos.truthEntropyVacuum.entropy * 100).toFixed(1) : 'N/A'}%
                  </div>
                  {cosmos.truthEntropyVacuum.hasVacuum && (
                    <Badge variant="destructive">Vacuum Detected</Badge>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Not analyzed</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Constellation Viewer</CardTitle>
          <CardDescription>
            Visualize trust constellations and proof orbits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
            <p className="text-muted-foreground">Constellation visualization coming soon</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

