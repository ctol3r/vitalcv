'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function ChainMeshPage() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/observability-mesh/health`)
      .then((res) => res.json())
      .then((data) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load chain mesh', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>On-Chain Observability Mesh</CardTitle>
          <CardDescription>Deep visibility into validator health and performance</CardDescription>
        </CardHeader>
        <CardContent>
          {health?.validators ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Validators ({health.validators.length})</h3>
                <div className="space-y-2">
                  {health.validators.map((validator: any, i: number) => (
                    <div key={i} className="p-3 border rounded">
                      <div className="font-medium">{validator.nodeId}</div>
                      <div className="text-sm text-muted-foreground">
                        Status: {validator.status} • CPU: {validator.cpu}% • Memory: {validator.memory}% • Block Lag: {validator.blockLag} • Peers: {validator.peerCount}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>No validator health data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

