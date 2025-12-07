'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Network, RefreshCw, Anchor } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function RegEntanglementPage() {
  const [entanglement, setEntanglement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEntanglement();
  }, []);

  const loadEntanglement = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/reg-entanglement`);
      if (!res.ok) throw new Error('Failed to load entanglement');
      const data = await res.json();
      setEntanglement(data.entanglement);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/reg-entanglement/anchor`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to anchor');
      await loadEntanglement();
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
          <h1 className="text-3xl font-bold">Regulatory Network Entanglement</h1>
          <p className="text-muted-foreground">
            Map regulatory agencies, boards, rule interactions, and influence flows
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadEntanglement}>
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
          <CardTitle>Regulators</CardTitle>
          <CardDescription>Regulatory agencies and boards in the network</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {entanglement?.regulators?.map((regulator: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <div className="font-medium">{regulator.name}</div>
                  <div className="text-sm text-muted-foreground">{regulator.type}</div>
                </div>
                <Badge>Influence: {regulator.influence}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {entanglement?.conflicts && entanglement.conflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Rule Conflicts</CardTitle>
            <CardDescription>Detected conflicts between regulatory rules</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {entanglement.conflicts.map((conflict: any, idx: number) => (
                <div key={idx} className="p-3 border rounded">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <Badge variant={conflict.severity === 'high' ? 'destructive' : 'default'}>
                      {conflict.severity}
                    </Badge>
                  </div>
                  <p className="font-medium">{conflict.rule1} vs {conflict.rule2}</p>
                  <p className="text-sm text-muted-foreground">{conflict.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {entanglement?.harmonization && (
        <Card>
          <CardHeader>
            <CardTitle>Harmonization</CardTitle>
            <CardDescription>Optimization suggestions to reduce conflicts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {entanglement.harmonization.suggestions?.map((suggestion: any, idx: number) => (
                <div key={idx} className="p-3 border rounded">
                  <p className="font-medium">{suggestion.config}</p>
                  <p className="text-sm text-muted-foreground">{suggestion.benefit}</p>
                  <Badge className="mt-2">
                    Conflicts reduced: {suggestion.conflictsReduced}
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

