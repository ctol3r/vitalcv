'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Heart, TrendingUp, AlertTriangle, Anchor } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function RelationshipIntelPage() {
  const searchParams = useSearchParams();
  const clinicianId = searchParams.get('clinicianId') || 'self';
  const employerId = searchParams.get('employerId') || 'employer1';
  const [intel, setIntel] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIntel();
  }, [clinicianId, employerId]);

  const fetchIntel = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/relationship-intel/${clinicianId}/${employerId}`);
      if (res.ok) {
        const data = await res.json();
        setIntel(data.intel);
      }
    } catch (error) {
      console.error('Failed to fetch relationship intel', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/relationship-intel/${clinicianId}/${employerId}/anchor`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Relationship intel anchored! Digest: ${data.digest}`);
        fetchIntel();
      }
    } catch (error) {
      console.error('Failed to anchor intel', error);
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relationship Intelligence</h1>
          <p className="text-muted-foreground mt-2">
            Trust, fairness, bias, safety, and longevity signals between clinicians and employers
          </p>
        </div>
        <Button onClick={handleAnchor}>
          <Anchor className="mr-2 h-4 w-4" />
          Anchor Intel
        </Button>
      </div>

      {intel && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  Clinician Trust
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{intel.clinicianTrust?.toFixed(0) || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  Employer Trust
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{intel.employerTrust?.toFixed(0) || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Retention Odds
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{intel.retentionOdds?.toFixed(0) || 0}%</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Fairness Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{intel.fairnessScore?.toFixed(0) || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Bias Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{intel.biasRisk?.toFixed(0) || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Safety Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{intel.safetyScore?.toFixed(0) || 0}</div>
              </CardContent>
            </Card>
          </div>

          {intel.frictionPoints && intel.frictionPoints.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Friction Points
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {intel.frictionPoints.map((f: any, i: number) => (
                    <div key={i} className="flex items-center justify-between">
                      <span>{f.type}</span>
                      <Badge variant={f.severity > 70 ? 'destructive' : 'secondary'}>
                        {f.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {intel.interventions && intel.interventions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Suggested Interventions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {intel.interventions.map((i: any, idx: number) => (
                    <div key={idx} className="p-2 border rounded">
                      <div className="font-medium">{i.type}</div>
                      <div className="text-sm text-muted-foreground">{i.description}</div>
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








