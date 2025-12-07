'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, TrendingUp, RefreshCw, Anchor } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function EmployerGravityPage() {
  const [gravity, setGravity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orgId = 'demo-org-id'; // In production, get from context

  useEffect(() => {
    loadGravity();
  }, []);

  const loadGravity = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/behavioral-gravity/${orgId}`);
      if (!res.ok) throw new Error('Failed to load gravity');
      const data = await res.json();
      setGravity(data.gravity);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/behavioral-gravity/${orgId}/anchor`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to anchor');
      await loadGravity();
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
          <h1 className="text-3xl font-bold">Employer Behavioral Gravity</h1>
          <p className="text-muted-foreground">
            Model how strongly each employer pulls clinicians in hiring gravity
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadGravity}>
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
          <CardTitle>Overall Gravity Score</CardTitle>
          <CardDescription>Composite score of employer attractiveness</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold">{gravity?.overallGravity || 0}</div>
            <div className="flex-1">
              <div className="h-4 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${gravity?.overallGravity || 0}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Demand Volatility</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gravity?.demandVolatility || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Offer Competitiveness</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gravity?.offerCompetitiveness || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fairness Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gravity?.fairness?.score || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trust Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gravity?.trust?.score || 0}</div>
          </CardContent>
        </Card>
      </div>

      {gravity?.specialtyGravity && Object.keys(gravity.specialtyGravity).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Specialty Gravity Overlay</CardTitle>
            <CardDescription>Pull strength by specialty</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(gravity.specialtyGravity).map(([specialty, score]: [string, any]) => (
                <div key={specialty} className="flex items-center justify-between">
                  <span>{specialty}</span>
                  <Badge>{score}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {gravity?.competitivePosition && (
        <Card>
          <CardHeader>
            <CardTitle>Competitive Position</CardTitle>
            <CardDescription>Rank vs competitors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span>Rank: {gravity.competitivePosition.rank}</span>
              </div>
              <div>
                <span>Percentile: {gravity.competitivePosition.percentile}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

