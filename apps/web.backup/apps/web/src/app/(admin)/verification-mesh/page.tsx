'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface VerificationMesh {
  integrity: {
    quorum: number;
    consensus: 'healthy' | 'degraded' | 'failed';
    nodes: string[];
  };
  drift: Array<{
    nodeId: string;
    type: 'unauthorized' | 'offline' | 'misconfigured';
    severity: 'low' | 'medium' | 'high';
  }>;
}

export default function VerificationMeshPage() {
  const [mesh, setMesh] = useState<VerificationMesh | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMesh = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/verification-mesh');
      const data = await res.json();
      setMesh(data);
    } catch (error) {
      console.error('Failed to fetch verification mesh:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMesh();
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Multi-Chain Permissioned Verification Mesh</h1>
        <p className="text-muted-foreground mt-2">
          A permissioned mesh that governs verification across all chains, proofs, issuers & verifiers
        </p>
      </div>

      {loading && <div className="text-center py-8">Loading...</div>}

      {mesh && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Mesh Integrity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Consensus Status</span>
                  <Badge variant={
                    mesh.integrity.consensus === 'healthy' ? 'default' :
                    mesh.integrity.consensus === 'degraded' ? 'default' : 'destructive'
                  }>
                    {mesh.integrity.consensus}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Quorum</span>
                  <Badge variant="outline">{mesh.integrity.quorum}</Badge>
                </div>
                {mesh.integrity.nodes.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold mb-1">Active Nodes:</div>
                    <div className="flex flex-wrap gap-2">
                      {mesh.integrity.nodes.map((node, idx) => (
                        <Badge key={idx} variant="outline">{node}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {mesh.drift.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Mesh Drift</CardTitle>
                <CardDescription>Detected unauthorized verifiers/nodes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {mesh.drift.map((driftItem, idx) => (
                    <div key={idx} className="p-3 border rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={
                          driftItem.severity === 'high' ? 'destructive' :
                          driftItem.severity === 'medium' ? 'default' : 'outline'
                        }>
                          {driftItem.severity}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{driftItem.type}</span>
                      </div>
                      <div className="text-sm font-mono">{driftItem.nodeId}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {mesh.integrity.consensus === 'failed' && (
            <Alert variant="destructive">
              <AlertDescription>
                <div className="font-semibold mb-2">Mesh Integrity Failed</div>
                <div className="text-sm">
                  The verification mesh is in a failed state. Immediate attention required.
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}








