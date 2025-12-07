'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle2, RefreshCw, Download, Anchor } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function CohesionPage() {
  const [cohesion, setCohesion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clinicianId = 'demo-clinician-id'; // In production, get from auth context

  useEffect(() => {
    loadCohesion();
  }, []);

  const loadCohesion = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/credential-cohesion/${clinicianId}`);
      if (!res.ok) throw new Error('Failed to load cohesion');
      const data = await res.json();
      setCohesion(data.cohesion);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/credential-cohesion/${clinicianId}/anchor`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to anchor');
      await loadCohesion();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
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
          <h1 className="text-3xl font-bold">Credential Cohesion</h1>
          <p className="text-muted-foreground">
            Ensure all credentials remain semantically, temporally, and structurally cohesive
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadCohesion}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleAnchor}>
            <Anchor className="h-4 w-4 mr-2" />
            Anchor
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Field Alignment</CardTitle>
          <CardDescription>Alignment status across credential fields</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Aligned fields: {cohesion?.fieldAlignment?.aligned?.length || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span>Misaligned fields: {cohesion?.fieldAlignment?.misaligned?.length || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Temporal Coherence</CardTitle>
          <CardDescription>Date consistency across credentials</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {cohesion?.temporalCoherence?.consistent ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>All dates are consistent</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span>Date conflicts detected</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Decay Prediction</CardTitle>
          <CardDescription>Predicted loss of coherence</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Badge variant={cohesion?.decayPrediction?.riskLevel === 'high' ? 'destructive' : 'default'}>
              Risk: {cohesion?.decayPrediction?.riskLevel || 'unknown'}
            </Badge>
            <p>Predicted decay in: {cohesion?.decayPrediction?.predictedDecayMonths || 0} months</p>
          </div>
        </CardContent>
      </Card>

      {cohesion?.reinforcementSuggestions && cohesion.reinforcementSuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reinforcement Suggestions</CardTitle>
            <CardDescription>Proactive fixes to improve cohesion</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cohesion.reinforcementSuggestions.map((suggestion: any, idx: number) => (
                <div key={idx} className="p-3 border rounded">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={suggestion.priority === 'high' ? 'destructive' : 'default'}>
                      {suggestion.priority}
                    </Badge>
                  </div>
                  <p className="font-medium">{suggestion.action}</p>
                  <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

