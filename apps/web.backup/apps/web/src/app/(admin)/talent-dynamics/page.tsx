'use client';

import { useCallback, useState } from 'react';
import { Users, TrendingUp, AlertTriangle, Target, FileDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function TalentDynamicsPage() {
  const [orgId, setOrgId] = useState('');
  const [clinicianId, setClinicianId] = useState('');
  const [dynamics, setDynamics] = useState<any>(null);
  const [mobility, setMobility] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDynamics = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/talent-dynamics/${orgId}`);
      if (!response.ok) {
        throw new Error(`Failed to load dynamics (${response.status})`);
      }
      const data = await response.json();
      setDynamics(data);
    } catch (err) {
      console.error('Failed to fetch dynamics', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const fetchMobility = useCallback(async () => {
    if (!orgId) return;
    try {
      const response = await fetch(`${API_BASE}/api/talent-dynamics/mobility/${orgId}`);
      const data = await response.json();
      setMobility(data);
    } catch (err) {
      console.error('Failed to fetch mobility', err);
    }
  }, [orgId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Talent Dynamics Engine</h1>
          <p className="text-muted-foreground">
            Model how clinicians move inside & between health systems — roles, promotions, burnout, retention
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View Talent Dynamics</CardTitle>
          <CardDescription>Enter an organization ID to view talent dynamics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="Organization ID"
              className="flex-1"
            />
            <Button onClick={fetchDynamics} disabled={!orgId || loading}>
              View Dynamics
            </Button>
            <Button onClick={fetchMobility} variant="outline" disabled={!orgId}>
              View Mobility
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && <p className="text-muted-foreground">Loading talent dynamics...</p>}

          {mobility && mobility.mobility && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Internal Mobility</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {mobility.mobility.map((move: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm">
                      {move.from} → {move.to}
                    </span>
                    <Badge variant="outline">{new Date(move.date).toLocaleDateString()}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {dynamics && dynamics.dynamics && (
            <div className="space-y-4">
              {dynamics.dynamics.retention && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Retention Risk</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Risk Level</span>
                      <Badge variant={dynamics.dynamics.retention.risk === 'high' ? 'destructive' : dynamics.dynamics.retention.risk === 'medium' ? 'secondary' : 'default'}>
                        {dynamics.dynamics.retention.risk}
                      </Badge>
                    </div>
                    {dynamics.dynamics.retention.factors && dynamics.dynamics.retention.factors.length > 0 && (
                      <div>
                        <span className="text-sm font-medium">Factors:</span>
                        <ul className="list-disc list-inside text-sm text-muted-foreground">
                          {dynamics.dynamics.retention.factors.map((f: string, i: number) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {dynamics.dynamics.burnout && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Burnout Risk</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Risk Level</span>
                      <Badge variant={dynamics.dynamics.burnout.risk === 'high' ? 'destructive' : dynamics.dynamics.burnout.risk === 'medium' ? 'secondary' : 'default'}>
                        {dynamics.dynamics.burnout.risk}
                      </Badge>
                    </div>
                    {dynamics.dynamics.burnout.recommendations && dynamics.dynamics.burnout.recommendations.length > 0 && (
                      <div>
                        <span className="text-sm font-medium">Recommendations:</span>
                        <ul className="list-disc list-inside text-sm text-muted-foreground">
                          {dynamics.dynamics.burnout.recommendations.map((r: string, i: number) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {dynamics.dynamics.leadership && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Leadership Potential</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Potential</span>
                      <Progress value={dynamics.dynamics.leadership.potential * 100} className="w-32" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Readiness</span>
                      <Progress value={dynamics.dynamics.leadership.readiness * 100} className="w-32" />
                    </div>
                    {dynamics.dynamics.leadership.path && dynamics.dynamics.leadership.path.length > 0 && (
                      <div>
                        <span className="text-sm font-medium">Career Path:</span>
                        <ul className="list-disc list-inside text-sm text-muted-foreground">
                          {dynamics.dynamics.leadership.path.map((p: string, i: number) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
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

