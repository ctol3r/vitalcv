'use client';

import { useCallback, useState } from 'react';
import { MapPin, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function ScopePage() {
  const [clinicianId, setClinicianId] = useState('');
  const [scope, setScope] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchScope = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/scope-logic/${clinicianId}`);
      if (!response.ok) {
        throw new Error(`Failed to load scope (${response.status})`);
      }
      const data = await response.json();
      setScope(data.scope);
    } catch (err) {
      console.error('Failed to fetch scope', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clinical Scope-of-Practice Logic</h1>
        <p className="text-muted-foreground">
          Define, validate, and predict legal clinical scope-of-practice across states, compacts, and roles
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scope of Practice</CardTitle>
          <CardDescription>Enter a clinician ID to view scope-of-practice information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              placeholder="Clinician ID"
              className="flex-1"
            />
            <Button onClick={fetchScope} disabled={!clinicianId || loading}>
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

          {loading && <p className="text-muted-foreground">Loading scope...</p>}

          {scope && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={scope.validated ? 'default' : 'destructive'}>
                  {scope.validated ? 'Validated' : 'Conflicts Detected'}
                </Badge>
                {scope.conflicts.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {scope.conflicts.length} conflict(s)
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Compact States</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {scope.normalized.compactStates.map((state: string) => (
                        <Badge key={state} variant="outline">{state}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Non-Compact States</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {scope.normalized.nonCompactStates.map((state: string) => (
                        <Badge key={state} variant="outline">{state}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {scope.expansionEligibility.possible && (
                <Card>
                  <CardHeader>
                    <CardTitle>Expansion Eligibility</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-2">Possible expansion to:</p>
                    <div className="space-y-1">
                      {scope.expansionEligibility.states.map((state: string) => (
                        <Badge key={state} variant="secondary">{state}</Badge>
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

