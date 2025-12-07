'use client';

import { useCallback, useState } from 'react';
import { Globe, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function RegulatoryMatrixPage() {
  const [clinicianId, setClinicianId] = useState('');
  const [matrix, setMatrix] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMatrix = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/regulatory-matrix/${clinicianId}`);
      if (!response.ok) {
        throw new Error(`Failed to load matrix (${response.status})`);
      }
      const data = await response.json();
      setMatrix(data.matrix);
    } catch (err) {
      console.error('Failed to fetch matrix', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Interoperable Regulatory State Matrix</h1>
        <p className="text-muted-foreground">
          Master matrix showing every regulatory state a clinician is in — by jurisdiction, chain, and credential
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Regulatory Matrix</CardTitle>
          <CardDescription>Enter a clinician ID to view regulatory state matrix</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              placeholder="Clinician ID"
              className="flex-1"
            />
            <Button onClick={fetchMatrix} disabled={!clinicianId || loading}>
              Load
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && <p className="text-muted-foreground">Loading matrix...</p>}

          {matrix && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Jurisdictions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{matrix.states.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Conflicts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{matrix.conflicts.length}</div>
                  </CardContent>
                </Card>
              </div>

              {matrix.riskOverlay.hotspots.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Risk Hotspots</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {matrix.riskOverlay.hotspots.map((hotspot: any, i: number) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-sm">{hotspot.jurisdiction}</span>
                          <Badge variant={hotspot.riskLevel === 'high' ? 'destructive' : 'secondary'}>
                            {hotspot.riskLevel}
                          </Badge>
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

