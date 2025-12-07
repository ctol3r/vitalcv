'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Map, TrendingUp, Target } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function HolomapPage() {
  const [loading, setLoading] = useState(true);
  const [holomap, setHolomap] = useState<any>(null);
  const clinicianId = 'default'; // Would come from auth context

  useEffect(() => {
    loadHolomap();
  }, []);

  async function loadHolomap() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/holomap/${clinicianId}`);
      if (res.ok) {
        const data = await res.json();
        setHolomap(data.map);
      }
    } catch (error) {
      console.error('Failed to load holomap:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !holomap) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const nodes = holomap?.nodes || [];
  const opportunities = holomap?.opportunities || [];
  const trajectory = holomap?.trajectory || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clinician Journey Holomap</h1>
          <p className="text-muted-foreground mt-2">
            Professional universe: relationships, skills, roles, evidence & events
          </p>
        </div>
        <Button variant="outline" onClick={loadHolomap}>
          Refresh
        </Button>
      </div>

      {holomap?.narrative && (
        <Card>
          <CardHeader>
            <CardTitle>Professional Narrative</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{holomap.narrative}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Nodes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{nodes.length}</div>
            <div className="text-sm text-muted-foreground mt-2">Journey milestones</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{opportunities.length}</div>
            <div className="text-sm text-muted-foreground mt-2">Available opportunities</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trajectory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{trajectory.length}</div>
            <div className="text-sm text-muted-foreground mt-2">Predicted paths</div>
          </CardContent>
        </Card>
      </div>

      {opportunities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {opportunities.map((opp: any, idx: number) => (
                <div key={idx} className="p-3 border rounded flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{opp.description}</div>
                    <div className="text-sm text-muted-foreground">{opp.type}</div>
                  </div>
                  <Badge>Match: {opp.matchScore.toFixed(0)}%</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}








