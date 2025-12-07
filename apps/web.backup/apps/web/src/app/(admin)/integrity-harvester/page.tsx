'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw, Download, Anchor, Shield } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function IntegrityHarvesterPage() {
  const [integrity, setIntegrity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [credentialId, setCredentialId] = useState('demo-credential-id');

  useEffect(() => {
    loadIntegrity();
  }, [credentialId]);

  const loadIntegrity = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/integrity-harvester/${credentialId}`);
      if (!res.ok) throw new Error('Failed to load integrity');
      const data = await res.json();
      setIntegrity(data.integrity);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/integrity-harvester/${credentialId}/anchor`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to anchor');
      await loadIntegrity();
    } catch (err: any) {
      setError(err.message);
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

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Integrity Harvester</h1>
          <p className="text-muted-foreground">
            Harvest, verify, and preserve integrity proofs across all chains, wallets & formats
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadIntegrity}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleAnchor}>
            <Anchor className="h-4 w-4 mr-2" />
            Anchor
          </Button>
        </div>
      </div>

      {integrity && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Substrate Proofs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {integrity.proofs?.substrate?.length || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>EVM Proofs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{integrity.proofs?.evm?.length || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cosmos Proofs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{integrity.proofs?.cosmos?.length || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>EUDI Proofs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{integrity.proofs?.eudi?.length || 0}</div>
              </CardContent>
            </Card>
          </div>

          {integrity.trustAdjusted?.validationResults &&
            integrity.trustAdjusted.validationResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Trust-Adjusted Validation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {integrity.trustAdjusted.validationResults.map((v: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{v.chain}</p>
                          <p className="text-sm text-muted-foreground">
                            Trust Level: {(v.trustLevel * 100).toFixed(0)}%
                          </p>
                        </div>
                        <Badge variant={v.valid ? 'default' : 'destructive'}>
                          {v.valid ? 'Valid' : 'Invalid'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

          {integrity.orphan?.detected && (
            <Card>
              <CardHeader>
                <CardTitle>Orphan Proofs Detected</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {integrity.orphan.orphanProofs.map((op: any, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <Badge variant="destructive">{op.chain}</Badge>
                      <div>
                        <p className="font-medium">{op.proofId}</p>
                        <p className="text-sm text-muted-foreground">{op.issue}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

