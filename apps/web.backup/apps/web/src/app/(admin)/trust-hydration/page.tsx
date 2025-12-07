'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, Link as LinkIcon } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function TrustHydrationPage() {
  const [loading, setLoading] = useState(true);
  const [hydration, setHydration] = useState<any>(null);

  useEffect(() => {
    loadHydration();
  }, []);

  async function loadHydration() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/trust-hydration`);
      if (res.ok) {
        const data = await res.json();
        setHydration(data.hydration);
      }
    } catch (error) {
      console.error('Failed to load hydration:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !hydration) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const hydrated = hydration?.hydrated || { overallTrust: 0, confidence: 0 };
  const sources = hydration?.sources || [];
  const anchors = hydration?.anchors || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Chain Trust Hydration</h1>
          <p className="text-muted-foreground mt-2">
            Trust from chain anchors, proofs, DIDs, issuers, and cross-chain bridges
          </p>
        </div>
        <Button variant="outline" onClick={loadHydration}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Overall Trust</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{hydrated.overallTrust || 0}%</div>
            <div className="text-sm text-muted-foreground mt-2">Trust score</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trust Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{sources.length}</div>
            <div className="text-sm text-muted-foreground mt-2">Active sources</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chain Anchors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{anchors.length}</div>
            <div className="text-sm text-muted-foreground mt-2">Anchored proofs</div>
          </CardContent>
        </Card>
      </div>

      {hydration?.conflicts && hydration.conflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Trust Conflicts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {hydration.conflicts.map((conflict: any, idx: number) => (
                <li key={idx} className="p-3 border rounded">
                  <div className="font-semibold">{conflict.conflict}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Resolution: {conflict.resolution}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}








