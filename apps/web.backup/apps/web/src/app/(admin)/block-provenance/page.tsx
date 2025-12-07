'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Link2, Shield, AlertCircle, FileText } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function BlockProvenancePage() {
  const [loading, setLoading] = useState(true);
  const [credentialId] = useState('demo-credential-1'); // In production, get from params
  const [provenance, setProvenance] = useState<any>(null);
  const [gaps, setGaps] = useState<any[]>([]);
  const [density, setDensity] = useState<number | null>(null);

  useEffect(() => {
    loadProvenance();
  }, [credentialId]);

  async function loadProvenance() {
    try {
      setLoading(true);
      const [provenanceRes, gapsRes, densityRes] = await Promise.all([
        fetch(`${API_BASE}/api/block-provenance/${credentialId}`),
        fetch(`${API_BASE}/api/block-provenance/${credentialId}/gaps`),
        fetch(`${API_BASE}/api/block-provenance/${credentialId}/density`),
      ]);

      const provenanceData = await provenanceRes.json();
      if (provenanceData.success) {
        setProvenance(provenanceData.provenance);
      }

      const gapsData = await gapsRes.json();
      if (gapsData.success) {
        setGaps(gapsData.gaps || []);
      }

      const densityData = await densityRes.json();
      if (densityData.success) {
        setDensity(densityData.density);
      }
    } catch (error) {
      console.error('Failed to load provenance:', error);
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
        <h1 className="text-3xl font-bold">Block-Level Credential Provenance</h1>
        <p className="text-muted-foreground mt-2">
          Block-by-block provenance proofing across all credential life events
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Block Events
            </CardTitle>
            <CardDescription>Issuance, update, verify, revoke events</CardDescription>
          </CardHeader>
          <CardContent>
            {provenance && provenance.events && (
              <div className="space-y-2">
                {provenance.events.map((event: any, i: number) => (
                  <div key={i} className="p-2 border rounded">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{event.eventType}</Badge>
                      <Badge variant="outline">{event.chain}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Block {event.blockHeight} • {new Date(event.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Provenance Density
            </CardTitle>
            <CardDescription>Completeness of provenance chain</CardDescription>
          </CardHeader>
          <CardContent>
            {density !== null && (
              <>
                <div className="text-3xl font-bold mb-2">{density.toFixed(1)}/100</div>
                <Progress value={density} className="mt-4" />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Integrity Gaps
            </CardTitle>
            <CardDescription>Missing or suspicious blocks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {gaps.length > 0 ? (
                gaps.map((gap, i) => (
                  <div key={i} className="p-2 border rounded border-yellow-500">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{gap.type}</span>
                      <Badge
                        variant={gap.severity === 'high' ? 'destructive' : 'default'}
                      >
                        {gap.severity}
                      </Badge>
                    </div>
                    {gap.fromBlock && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Blocks {gap.fromBlock} → {gap.toBlock} (gap: {gap.gapSize})
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No integrity gaps detected</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Chain Stitching
            </CardTitle>
            <CardDescription>Events stitched across networks</CardDescription>
          </CardHeader>
          <CardContent>
            {provenance && provenance.chainStitching && (
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">Chains: </span>
                  {provenance.chainStitching.chains?.map((chain: string, i: number) => (
                    <Badge key={i} variant="outline" className="ml-1">
                      {chain}
                    </Badge>
                  ))}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Events: {provenance.chainStitching.totalEvents}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

