'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Link2, AlertTriangle, CheckCircle2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface AggregatedVC {
  id: string;
  type: string;
  normalized: any;
  sources: any[];
  merged: any;
  deduplicated: boolean;
}

export default function VCAggregatePage() {
  const [loading, setLoading] = useState(true);
  const [aggregated, setAggregated] = useState<AggregatedVC[]>([]);
  const [orphans, setOrphans] = useState<any[]>([]);
  const [clinicianId] = useState('demo-clinician-1'); // In production, get from auth

  useEffect(() => {
    loadAggregation();
  }, [clinicianId]);

  async function loadAggregation() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/vc-aggregate/${clinicianId}`);
      const data = await res.json();

      if (data.success && data.aggregation) {
        setAggregated(data.aggregation.aggregated || []);
      }

      // Load orphans
      const orphanRes = await fetch(`${API_BASE}/api/vc-aggregate/${clinicianId}/orphans`);
      const orphanData = await orphanRes.json();
      if (orphanData.success) {
        setOrphans(orphanData.orphans || []);
      }
    } catch (error) {
      console.error('Failed to load aggregation:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(format: 'VC' | 'PDF' | 'SD-JWT') {
    try {
      const res = await fetch(`${API_BASE}/api/vc-aggregate/${clinicianId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
      });

      if (format === 'PDF') {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vc-bundle-${clinicianId}.pdf`;
        a.click();
      } else {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vc-bundle-${clinicianId}.json`;
        a.click();
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  }

  async function handleAnchor() {
    try {
      const res = await fetch(`${API_BASE}/api/vc-aggregate/${clinicianId}/anchor`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        alert(`Anchored! TX: ${data.txHash}`);
      }
    } catch (error) {
      console.error('Anchor failed:', error);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">VC Aggregation</h1>
          <p className="text-muted-foreground mt-2">
            Unified view of all credentials across issuers, chains, and formats
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleExport('VC')} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export VC
          </Button>
          <Button onClick={() => handleExport('SD-JWT')} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export SD-JWT
          </Button>
          <Button onClick={handleAnchor}>
            <Link2 className="mr-2 h-4 w-4" />
            Anchor Snapshot
          </Button>
        </div>
      </div>

      {orphans.length > 0 && (
        <Card className="border-yellow-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Orphan Credentials
            </CardTitle>
            <CardDescription>
              {orphans.length} credential(s) with no active issuer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {orphans.map((orphan, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline">{orphan.format}</Badge>
                  <span className="text-muted-foreground">{orphan.issuer}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {aggregated.map((vc) => (
          <Card key={vc.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{vc.type}</CardTitle>
                  <CardDescription>
                    {vc.sources.length} source(s) • {vc.deduplicated ? 'Deduplicated' : 'Unique'}
                  </CardDescription>
                </div>
                {vc.deduplicated && (
                  <Badge variant="secondary">Deduplicated</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Sources</h4>
                  <div className="flex flex-wrap gap-2">
                    {vc.sources.map((source: any, i: number) => (
                      <Badge key={i} variant="outline">
                        {source.format} • {source.issuer.slice(0, 20)}...
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2">Normalized Data</h4>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                    {JSON.stringify(vc.normalized, null, 2)}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {aggregated.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No aggregated credentials found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

