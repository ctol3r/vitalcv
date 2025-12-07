'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Network, TrendingUp, Users, Zap } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function NetworkEffectsPage() {
  const [loading, setLoading] = useState(true);
  const [influenceScore, setInfluenceScore] = useState<number | null>(null);
  const [magnetEmployers, setMagnetEmployers] = useState<any[]>([]);
  const [frictionHotspots, setFrictionHotspots] = useState<any>(null);
  const [orgId] = useState('demo-org-1');

  useEffect(() => {
    loadNetworkEffects();
  }, [orgId]);

  async function loadNetworkEffects() {
    try {
      setLoading(true);

      const [influenceRes, magnetsRes, frictionRes] = await Promise.all([
        fetch(`${API_BASE}/api/employer-network-effects/${orgId}/influence-score`),
        fetch(`${API_BASE}/api/employer-network-effects/magnet-employers?limit=10`),
        fetch(`${API_BASE}/api/employer-network-effects/${orgId}/friction-hotspots`),
      ]);

      const influenceData = await influenceRes.json();
      const magnetsData = await magnetsRes.json();
      const frictionData = await frictionRes.json();

      if (influenceData.success) {
        setInfluenceScore(influenceData.score);
      }
      if (magnetsData.success) {
        setMagnetEmployers(magnetsData.magnets);
      }
      if (frictionData.success) {
        setFrictionHotspots(frictionData.hotspots);
      }
    } catch (error) {
      console.error('Failed to load network effects:', error);
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
        <h1 className="text-3xl font-bold">Employer Network Effects</h1>
        <p className="text-muted-foreground mt-2">
          Model how employer behavior influences marketplace liquidity, hiring velocity, and outcomes
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Influence Score
            </CardTitle>
            <CardDescription>Employer impact on platform ecosystem</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{influenceScore?.toFixed(1) || '0'}/100</div>
            <p className="text-sm text-muted-foreground mt-2">Platform influence rating</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Friction Hotspots
            </CardTitle>
            <CardDescription>Where workflows slow hiring</CardDescription>
          </CardHeader>
          <CardContent>
            {frictionHotspots && (
              <div className="space-y-2">
                <div className="text-2xl font-bold">{frictionHotspots.overallFriction?.toFixed(1) || '0'}/100</div>
                <p className="text-sm text-muted-foreground">Overall friction score</p>
                <div className="mt-3 space-y-1">
                  {frictionHotspots.hotspots?.slice(0, 3).map((hotspot: any, i: number) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium">{hotspot.stage}:</span>{' '}
                      <span className="text-muted-foreground">{hotspot.frictionScore.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Magnet Employers
            </CardTitle>
            <CardDescription>Top talent attractors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{magnetEmployers.length}</div>
            <p className="text-sm text-muted-foreground mt-2">Employers detected</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Magnet Employers
          </CardTitle>
          <CardDescription>Employers who attract top talent</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {magnetEmployers.slice(0, 5).map((employer: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <p className="font-medium">{employer.orgId}</p>
                  <p className="text-sm text-muted-foreground">
                    Magnet Score: {employer.magnetScore?.toFixed(1)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {employer.attractionFactors?.slice(0, 2).map((factor: string, j: number) => (
                    <Badge key={j} variant="secondary">{factor}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

