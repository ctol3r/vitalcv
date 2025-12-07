'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Link2, CheckCircle2, AlertCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function MultiChainPage() {
  const [loading, setLoading] = useState(false);
  const [vcId, setVcId] = useState('');
  const [preferredChain, setPreferredChain] = useState<'substrate' | 'evm' | 'cosmos' | 'w3c'>('substrate');
  const [proof, setProof] = useState<any>(null);
  const [verified, setVerified] = useState<boolean | null>(null);

  async function handleResolve() {
    if (!vcId) return;

    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE}/api/multi-chain/${vcId}/resolve?preferredChain=${preferredChain}`
      );
      const data = await res.json();
      if (data.success) {
        setProof(data.proof);
      }
    } catch (error) {
      console.error('Failed to resolve proof:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!proof) return;

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/multi-chain/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof }),
      });
      const data = await res.json();
      setVerified(data.verified);
    } catch (error) {
      console.error('Verification failed:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Multi-Chain Proof Layer</h1>
        <p className="text-muted-foreground mt-2">
          Verify credentials across Substrate, EVM, Cosmos, and W3C networks
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resolve Proof</CardTitle>
          <CardDescription>Select VC and preferred chain</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">VC ID</label>
            <input
              type="text"
              value={vcId}
              onChange={(e) => setVcId(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded"
              placeholder="Enter VC ID"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Preferred Chain</label>
            <Select value={preferredChain} onValueChange={(v: any) => setPreferredChain(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="substrate">Substrate</SelectItem>
                <SelectItem value="evm">EVM (Ethereum/Polygon)</SelectItem>
                <SelectItem value="cosmos">Cosmos IBC</SelectItem>
                <SelectItem value="w3c">W3C</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleResolve} disabled={loading || !vcId}>
            {loading ? 'Resolving...' : 'Resolve Proof'}
          </Button>
        </CardContent>
      </Card>

      {proof && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Proof Details
            </CardTitle>
            <CardDescription>Chain: {proof.chain}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Badge>{proof.chain}</Badge>
              {proof.txHash && (
                <Badge variant="outline" className="ml-2">
                  TX: {proof.txHash.slice(0, 16)}...
                </Badge>
              )}
            </div>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto">
              {JSON.stringify(proof.proof, null, 2)}
            </pre>
            <Button onClick={handleVerify} disabled={loading}>
              {loading ? 'Verifying...' : 'Verify Proof'}
            </Button>
            {verified !== null && (
              <div className="flex items-center gap-2">
                {verified ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-green-500">Proof verified</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <span className="text-red-500">Proof verification failed</span>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

