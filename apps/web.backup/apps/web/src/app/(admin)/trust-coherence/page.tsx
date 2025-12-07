'use client';

import { useEffect, useState } from 'react';
import { Shield, AlertTriangle, CheckCircle2, Anchor } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function TrustCoherencePage() {
  const [coherence, setCoherence] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCoherence();
  }, []);

  const fetchCoherence = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/trust-coherence`);
      if (res.ok) {
        const data = await res.json();
        setCoherence(data.coherence);
      }
    } catch (error) {
      console.error('Failed to fetch trust coherence', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/trust-coherence/anchor`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Trust coherence anchored! Digest: ${data.digest}`);
        fetchCoherence();
      }
    } catch (error) {
      console.error('Failed to anchor coherence', error);
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

  const c = coherence?.coherence;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trust Coherence Engine</h1>
          <p className="text-muted-foreground mt-2">
            Ensures trust decisions stay coherent across chain state, issuer trust, proof type & verifier class
          </p>
        </div>
        <Button onClick={handleAnchor}>
          <Anchor className="mr-2 h-4 w-4" />
          Anchor Coherence
        </Button>
      </div>

      {c && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Chain Trust
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {c.reconciliation?.chainTrust?.toFixed(0) || 0}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Lag: {c.chainState?.lag || 0}ms
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Issuer Trust</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {c.reconciliation?.issuerTrust?.toFixed(0) || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Reconciled</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {c.reconciliation?.reconciled?.toFixed(0) || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          {c.conflicts && c.conflicts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Trust Conflicts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {c.conflicts.map((conflict: any, i: number) => (
                    <div key={i} className="flex items-center justify-between">
                      <span>{conflict.type}: {conflict.description}</span>
                      <Badge variant={conflict.severity > 70 ? 'destructive' : 'secondary'}>
                        {conflict.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {c.elasticity && (
            <Card>
              <CardHeader>
                <CardTitle>Trust Elasticity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Base Trust</span>
                    <Badge>{c.elasticity.baseTrust?.toFixed(0) || 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Stress Trust</span>
                    <Badge>{c.elasticity.stressTrust?.toFixed(0) || 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Elasticity</span>
                    <Badge>{c.elasticity.elasticity?.toFixed(2) || 0}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}








