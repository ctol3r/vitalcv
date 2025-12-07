'use client';

import { useCallback, useEffect, useState } from 'react';
import { Network, Shield, AlertTriangle, TrendingUp, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRoleUX } from '@/contexts/RoleUXContext';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

export default function AttestationMeshPage() {
  const { formatError } = useRoleUX();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meshData, setMeshData] = useState<any>(null);
  const [clinicianId, setClinicianId] = useState<string>('');

  const load = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/attestation-mesh/${clinicianId}`);
      if (!response.ok) {
        throw new Error(`Mesh API failed (${response.status})`);
      }
      const payload = await response.json();
      setMeshData(payload);
    } catch (err) {
      console.error('[issuer][attestation-mesh] load failed', err);
      setError(formatError('mesh_fetch_failed', err instanceof Error ? err.message : 'Unable to load mesh'));
    } finally {
      setLoading(false);
    }
  }, [clinicianId, formatError]);

  const anchorSnapshot = useCallback(async () => {
    if (!clinicianId) return;
    try {
      const response = await fetch(`${API_BASE}/api/attestation-mesh/${clinicianId}/anchor`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Anchor failed');
      await load();
    } catch (err) {
      console.error('[issuer][attestation-mesh] anchor failed', err);
    }
  }, [clinicianId, load]);

  useEffect(() => {
    if (clinicianId) {
      void load();
    }
  }, [clinicianId, load]);

  if (loading && !meshData) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Global Credential Attestation Mesh v10</CardTitle>
            <CardDescription>Loading mesh data...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Global Credential Attestation Mesh v10
              </CardTitle>
              <CardDescription>
                30-node mesh synchronizing, verifying, and stabilizing attestations across issuers, regulators, employers & chains
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Clinician ID"
                value={clinicianId}
                onChange={(e) => setClinicianId(e.target.value)}
                className="px-3 py-2 border rounded"
              />
              <Button onClick={load} disabled={!clinicianId}>
                Load
              </Button>
              <Button onClick={anchorSnapshot} disabled={!clinicianId || loading}>
                Anchor
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded">
              {error}
            </div>
          )}

          {meshData && (
            <div className="space-y-6">
              {/* Summary Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Total Nodes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{meshData.nodes?.length || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Integrity Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{meshData.integrity?.score || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Consistency Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{meshData.consistency?.score || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Redundancy Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{meshData.redundancy?.score || 0}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Entropy & Drift */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Entropy Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Entropy Score:</span>
                        <Badge variant={meshData.entropy?.score > 50 ? 'destructive' : 'default'}>
                          {meshData.entropy?.score || 0}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Randomness:</span>
                        <span>{meshData.entropy?.randomness || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Instability:</span>
                        <span>{meshData.entropy?.instability || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Gaps & Issues
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Gaps Found:</span>
                        <Badge>{meshData.gaps?.length || 0}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Weak Nodes:</span>
                        <Badge variant="destructive">{meshData.integrity?.weakNodes?.length || 0}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Inconsistent Nodes:</span>
                        <Badge variant="destructive">{meshData.integrity?.inconsistentNodes?.length || 0}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Mismatches */}
              {meshData.consistency?.mismatches && meshData.consistency.mismatches.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Consistency Mismatches</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {meshData.consistency.mismatches.slice(0, 5).map((mismatch: any, idx: number) => (
                        <div key={idx} className="p-2 bg-muted rounded">
                          <div className="text-sm font-medium">Field: {mismatch.field}</div>
                          <div className="text-xs text-muted-foreground">
                            Nodes: {mismatch.nodeIds.join(', ')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Values: {JSON.stringify(mismatch.values)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Timeline */}
              {meshData.timeline && meshData.timeline.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Mesh Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {meshData.timeline.slice(-10).map((event: any, idx: number) => (
                        <div key={idx} className="p-2 bg-muted rounded text-sm">
                          <div className="font-medium">{event.event}</div>
                          <div className="text-xs text-muted-foreground">{event.timestamp}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








