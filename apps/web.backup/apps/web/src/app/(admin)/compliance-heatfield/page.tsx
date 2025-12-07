'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw, Download, Anchor, Flame } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function ComplianceHeatfieldPage() {
  const [heatfield, setHeatfield] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState('global');
  const [scopeId, setScopeId] = useState('global');

  useEffect(() => {
    loadHeatfield();
  }, [scope, scopeId]);

  const loadHeatfield = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/compliance-heatfield/${scope}/${scopeId}`);
      if (!res.ok) throw new Error('Failed to load heatfield');
      const data = await res.json();
      setHeatfield(data.heatfield);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/compliance-heatfield/${scope}/${scopeId}/anchor`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to anchor');
      await loadHeatfield();
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
          <h1 className="text-3xl font-bold">Compliance Burden Heatfield</h1>
          <p className="text-muted-foreground">
            A heatfield showing where compliance burdens are heaviest across clinicians, employers, or regions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadHeatfield}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleAnchor}>
            <Anchor className="h-4 w-4 mr-2" />
            Anchor
          </Button>
        </div>
      </div>

      {heatfield && (
        <>
          {heatfield.heat?.burden && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="h-5 w-5" />
                  Compliance Burden
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Compliance Time</p>
                    <p className="text-2xl font-bold">{heatfield.heat.burden.avgComplianceTime || 0}h</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Requirement Frequency</p>
                    <p className="text-2xl font-bold">
                      {heatfield.heat.burden.requirementFrequency || 0}/year
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Friction Points</p>
                    <p className="text-2xl font-bold">
                      {heatfield.heat.burden.frictionPoints?.length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {heatfield.heat?.geographic && (
            <Card>
              <CardHeader>
                <CardTitle>Geographic Heatmap</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(heatfield.heat.geographic).map(([region, score]: [string, any]) => (
                    <div key={region} className="p-4 border rounded-lg">
                      <p className="font-medium">{region}</p>
                      <div className="mt-2">
                        <Badge
                          variant={
                            score >= 80
                              ? 'destructive'
                              : score >= 60
                                ? 'default'
                                : 'secondary'
                          }
                        >
                          {score}/100
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {heatfield.heat?.mitigation?.suggestions &&
            heatfield.heat.mitigation.suggestions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Mitigation Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {heatfield.heat.mitigation.suggestions.map((s: any, i: number) => (
                      <div key={i} className="flex items-start gap-2">
                        <Badge variant={s.impact === 'high' ? 'destructive' : 'default'}>
                          {s.impact}
                        </Badge>
                        <div>
                          <p className="font-medium">{s.area}</p>
                          <p className="text-sm text-muted-foreground">{s.improvement}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
        </>
      )}
    </div>
  );
}

