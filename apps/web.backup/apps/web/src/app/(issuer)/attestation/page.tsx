'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shield, Link, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRoleUX } from '@/contexts/RoleUXContext';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE_URL ||
  '';

export default function AttestationPage() {
  const { formatError } = useRoleUX();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attestationData, setAttestationData] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/attestation/chain`);
      if (!response.ok) {
        throw new Error(`Attestation API failed (${response.status})`);
      }
      const payload = await response.json();
      setAttestationData(payload);
    } catch (err) {
      console.error('[issuer][attestation] load failed', err);
      setError(formatError('attestation_fetch_failed', err instanceof Error ? err.message : 'Unable to load attestations'));
    } finally {
      setLoading(false);
    }
  }, [formatError]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Chain-Aware Attestation Engine</CardTitle>
            <CardDescription>Loading attestation data...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Chain-Aware Attestation Engine</CardTitle>
            <CardDescription className="text-destructive">{error}</CardDescription>
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
                <Shield className="h-5 w-5" />
                Chain-Aware Attestation Engine v5
              </CardTitle>
              <CardDescription>
                Smart attestation engine aware of chain anchors, issuer trust, revocation paths & multi-format proofs
              </CardDescription>
            </div>
            <Button onClick={load}>Refresh</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Total Attestations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{attestationData?.attestationCount || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Active Attestations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{attestationData?.activeCount || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Cross-Chain Mappings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{attestationData?.crossChainCount || 0}</div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

