'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Flow, TrendingUp, AlertTriangle, Target } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function TalentFlowPage() {
  const [loading, setLoading] = useState(true);
  const [routing, setRouting] = useState<any>(null);
  const [bottlenecks, setBottlenecks] = useState<any>(null);
  const [conflicts, setConflicts] = useState<any>(null);
  const [clinicianId] = useState('demo-clinician-1');

  useEffect(() => {
    loadTalentFlowData();
  }, [clinicianId]);

  async function loadTalentFlowData() {
    try {
      setLoading(true);

      const [routingRes, bottlenecksRes, conflictsRes] = await Promise.all([
        fetch(`${API_BASE}/api/talent-flow/${clinicianId}/route`),
        fetch(`${API_BASE}/api/talent-flow/${clinicianId}/bottlenecks`),
        fetch(`${API_BASE}/api/talent-flow/${clinicianId}/conflicts`),
      ]);

      const routingData = await routingRes.json();
      const bottlenecksData = await bottlenecksRes.json();
      const conflictsData = await conflictsRes.json();

      if (routingData.success) {
        setRouting(routingData.routing);
      }
      if (bottlenecksData.success) {
        setBottlenecks(bottlenecksData.bottlenecks);
      }
      if (conflictsData.success) {
        setConflicts(conflictsData.conflicts);
      }
    } catch (error) {
      console.error('Failed to load talent flow data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Intelligent Talent Flow Optimizer</h1>
        <p className="text-muted-foreground mt-2">
          Optimize clinician movement across roles, regions, employers, and shifts
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Best Fit Opportunity
            </CardTitle>
            <CardDescription>Talent routing engine</CardDescription>
          </CardHeader>
          <CardContent>
            {routing && routing.bestFit && (
              <div className="space-y-2">
                <div className="text-2xl font-bold">{routing.bestFit}</div>
                <p className="text-sm text-muted-foreground">
                  {routing.opportunities?.length || 0} opportunities found
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Flow Health
            </CardTitle>
            <CardDescription>Bottleneck analyzer</CardDescription>
          </CardHeader>
          <CardContent>
            {bottlenecks && (
              <div className="space-y-2">
                <div className="text-2xl font-bold">{bottlenecks.overallFlowHealth?.toFixed(0) || 0}/100</div>
                <p className="text-sm text-muted-foreground">
                  {bottlenecks.bottlenecks?.length || 0} bottlenecks detected
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flow className="h-5 w-5" />
              Conflicts
            </CardTitle>
            <CardDescription>Flow conflict detection</CardDescription>
          </CardHeader>
          <CardContent>
            {conflicts && (
              <div className="space-y-2">
                <div className="text-2xl font-bold">{conflicts.hasConflicts ? 'Yes' : 'No'}</div>
                <p className="text-sm text-muted-foreground">
                  {conflicts.conflicts?.length || 0} conflicts found
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {bottlenecks && bottlenecks.bottlenecks && bottlenecks.bottlenecks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Bottlenecks</CardTitle>
            <CardDescription>Where talent flow stalls</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bottlenecks.bottlenecks.map((bottleneck: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">{bottleneck.stage}</p>
                    <p className="text-sm text-muted-foreground">{bottleneck.impact}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={bottleneck.severity > 70 ? 'destructive' : 'secondary'}>
                      {bottleneck.severity.toFixed(0)}/100
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

