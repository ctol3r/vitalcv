'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function FusionFabricPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const clinicianId = 'demo-clinician-id'; // Replace with actual clinician ID
    fetch(`${API_BASE}/api/credential-fusion-fabric/${clinicianId}`)
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load fusion fabric', err);
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
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Multi-Layer Credential Fusion Fabric</CardTitle>
          <CardDescription>Fuse all credentials across chains, issuers, devices & regulators into a canonical master VC</CardDescription>
        </CardHeader>
        <CardContent>
          {data ? (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Credential Sources</h3>
                <div className="space-y-2">
                  {data.fusedCredentials?.sources?.map((source: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded">
                      <div className="flex items-center gap-2">
                        <Badge>{source.source}</Badge>
                        <span className="text-sm text-muted-foreground">{source.chain}</span>
                        <span className="text-sm text-muted-foreground">•</span>
                        <span className="text-sm text-muted-foreground">{source.issuer}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Conflicts & Resolutions</h3>
                <div className="space-y-2">
                  {data.fusedCredentials?.conflicts?.map((conflict: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded">
                      <div className="font-medium mb-1">{conflict.field}</div>
                      <div className="text-sm text-muted-foreground mb-2">
                        Values: {conflict.values?.join(', ')}
                      </div>
                      <Badge variant="outline">Resolved: {conflict.resolution}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Cross-Chain Integrity</h3>
                <div className="p-3 border rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span>Networks</span>
                    <Badge>{data.crossChainIntegrity?.networks?.join(', ')}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Status</span>
                    <Badge variant={data.crossChainIntegrity?.identical ? 'default' : 'destructive'}>
                      {data.crossChainIntegrity?.identical ? 'Identical' : 'Discrepancies Found'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Credential Evolution</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {data.evolution?.map((event: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{event.change}</span>
                        <span className="text-muted-foreground">
                          {new Date(event.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">{event.source}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Export Formats</h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(data.exportFormats?.paths || {}).map(([format, path]: [string, any]) => (
                    <div key={format} className="p-2 border rounded">
                      <Badge>{format}</Badge>
                      <div className="text-xs text-muted-foreground mt-1">{path}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>No fusion fabric data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








