'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface IdentityFabric {
  clinicianId: string;
  identities: Array<{
    type: string;
    identifier: string;
    chain?: string;
  }>;
  fusion: {
    unified: any;
    coherenceScore: number;
    collisions: Array<{
      id1: string;
      id2: string;
      overlap: string;
    }>;
  };
  divergence?: {
    predicted: boolean;
    drift: number;
  };
  reinforcement?: Array<{
    identifier: string;
    action: string;
    reason: string;
  }>;
}

export default function IdentityFabricPage() {
  const [fabric, setFabric] = useState<IdentityFabric | null>(null);
  const [loading, setLoading] = useState(true);
  const [clinicianId, setClinicianId] = useState('');

  const fetchFabric = async () => {
    if (!clinicianId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/identity-fabric/${clinicianId}`);
      const data = await res.json();
      setFabric(data);
    } catch (error) {
      console.error('Failed to fetch identity fabric:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Multiverse Identity Fabric</h1>
        <p className="text-muted-foreground mt-2">
          A fabric of all identity states across all DID methods, chains, jurisdictions & devices
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clinician ID</CardTitle>
          <CardDescription>Enter clinician ID to view identity fabric</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="text"
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              placeholder="Enter clinician ID"
              className="flex-1 px-3 py-2 border rounded-md"
            />
            <button
              onClick={fetchFabric}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Load
            </button>
          </div>
        </CardContent>
      </Card>

      {loading && <div className="text-center py-8">Loading...</div>}

      {fabric && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Coherence Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span>Identity Coherence</span>
                    <Badge variant="outline">
                      {(fabric.fusion.coherenceScore * 100).toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${fabric.fusion.coherenceScore * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {fabric.identities.length} identity states detected
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Identity States</CardTitle>
              <CardDescription>All identity states across methods and chains</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {fabric.identities.map((identity, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex items-center gap-2">
                      <Badge>{identity.type}</Badge>
                      <span className="font-mono text-sm">{identity.identifier}</span>
                      {identity.chain && (
                        <Badge variant="outline">{identity.chain}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {fabric.fusion.collisions.length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                <div className="font-semibold mb-2">
                  {fabric.fusion.collisions.length} Collision(s) Detected
                </div>
                <ul className="list-disc list-inside space-y-1">
                  {fabric.fusion.collisions.map((c, idx) => (
                    <li key={idx}>
                      {c.id1} vs {c.id2}: {c.overlap}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {fabric.divergence?.predicted && (
            <Alert>
              <AlertDescription>
                <div className="font-semibold mb-1">Divergence Predicted</div>
                <div className="text-sm">
                  Drift: {fabric.divergence.drift.toFixed(2)}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {fabric.reinforcement && fabric.reinforcement.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Reinforcement Suggestions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {fabric.reinforcement.map((rec, idx) => (
                    <div key={idx} className="p-3 border rounded-md">
                      <div className="font-semibold">{rec.identifier}</div>
                      <div className="text-sm text-muted-foreground mt-1">{rec.action}</div>
                      <div className="text-xs text-muted-foreground mt-1">{rec.reason}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

