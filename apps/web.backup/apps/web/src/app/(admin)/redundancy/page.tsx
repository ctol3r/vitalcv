'use client';

import { useEffect, useState } from 'react';
import { Link, RefreshCcw, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

interface ChainAnchor {
  chain: string;
  hash: string;
  txHash: string;
  status: string;
  timestamp: Date;
}

interface RedundancyFabric {
  vcId: string;
  chains: Record<string, ChainAnchor>;
}

export default function RedundancyPage() {
  const [fabrics, setFabrics] = useState<RedundancyFabric[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVcId, setSelectedVcId] = useState('');

  useEffect(() => {
    loadRedundancy();
  }, []);

  async function loadRedundancy() {
    setLoading(true);
    try {
      // In real implementation, would fetch list of VCs
      // For demo, using a sample VC ID
      const vcId = 'demo_vc_123';
      const response = await fetch(`${API_BASE}/api/redundancy/${vcId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.chains) {
          setFabrics([{ vcId, chains: data.chains }]);
        }
      }
    } catch (error) {
      console.error('Failed to load redundancy:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnchor(vcId: string) {
    try {
      const response = await fetch(`${API_BASE}/api/redundancy/${vcId}/anchor`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        alert(`Anchored! TX: ${data.txHash}`);
        loadRedundancy();
      }
    } catch (error) {
      console.error('Failed to anchor:', error);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Admin · Multi-Chain Redundancy</Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Redundancy Fabric</h1>
            <p className="text-muted-foreground">
              Redundant, resilient credential anchoring across multiple consensus systems
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-auto gap-2"
            onClick={loadRedundancy}
            disabled={loading}
          >
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </header>

      {fabrics.map((fabric) => (
        <Card key={fabric.vcId}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>VC: {fabric.vcId}</CardTitle>
                <CardDescription>Multi-chain anchor status</CardDescription>
              </div>
              <Button variant="outline" onClick={() => handleAnchor(fabric.vcId)}>
                Anchor State
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {Object.entries(fabric.chains).map(([chainName, anchor]) => (
                <div
                  key={chainName}
                  className={cn(
                    'rounded-lg border p-4',
                    anchor.status === 'active'
                      ? 'border-green-500 bg-green-50 dark:bg-green-950'
                      : 'border-red-500 bg-red-50 dark:bg-red-950'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold capitalize">{chainName}</div>
                    {anchor.status === 'active' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="font-mono text-xs">{anchor.hash.slice(0, 16)}...</div>
                    <div className="text-muted-foreground">
                      TX: {anchor.txHash.slice(0, 16)}...
                    </div>
                    <Badge variant={anchor.status === 'active' ? 'default' : 'destructive'}>
                      {anchor.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

