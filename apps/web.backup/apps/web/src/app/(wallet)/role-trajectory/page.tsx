'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw, Download, Anchor, TrendingUp } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function RoleTrajectoryPage() {
  const [trajectory, setTrajectory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clinicianId = 'demo-clinician-id';

  useEffect(() => {
    loadTrajectory();
  }, []);

  const loadTrajectory = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/role-trajectory/${clinicianId}`);
      if (!res.ok) throw new Error('Failed to load trajectory');
      const data = await res.json();
      setTrajectory(data.trajectory);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/role-trajectory/${clinicianId}/anchor`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to anchor');
      await loadTrajectory();
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
          <h1 className="text-3xl font-bold">Role & Privilege Trajectory</h1>
          <p className="text-muted-foreground">
            Graph all roles/privileges across your career: past → present → predicted future
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadTrajectory}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleAnchor}>
            <Anchor className="h-4 w-4 mr-2" />
            Anchor
          </Button>
        </div>
      </div>

      {trajectory && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Current Roles & Privileges</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Roles</p>
                  <div className="flex flex-wrap gap-2">
                    {trajectory.present?.roles?.map((role: string, i: number) => (
                      <Badge key={i} variant="default">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Privileges</p>
                  <div className="flex flex-wrap gap-2">
                    {trajectory.present?.privileges?.map((priv: string, i: number) => (
                      <Badge key={i} variant="secondary">
                        {priv}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {trajectory.predicted?.nextPrivileges && trajectory.predicted.nextPrivileges.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Predicted Privilege Progression
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {trajectory.predicted.nextPrivileges.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{p.privilege}</p>
                        <p className="text-sm text-muted-foreground">{p.timeline}</p>
                      </div>
                      <Badge variant={p.probability > 0.7 ? 'default' : 'secondary'}>
                        {(p.probability * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {trajectory.improvements && trajectory.improvements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Privilege Improvement Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {trajectory.improvements.map((imp: any, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <Badge variant={imp.priority === 'high' ? 'destructive' : 'default'}>
                        {imp.priority}
                      </Badge>
                      <div>
                        <p className="font-medium">{imp.privilege}</p>
                        <p className="text-sm text-muted-foreground">{imp.reason}</p>
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

