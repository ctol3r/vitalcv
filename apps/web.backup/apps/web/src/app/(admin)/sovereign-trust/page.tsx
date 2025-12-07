'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SovereignTrust {
  chains: Array<{
    chainId: string;
    trustScore: {
      score: number;
      sovereignty: number;
      factors: string[];
    };
    drift: {
      drift: number;
      factors: string[];
    };
    equivalencies: Array<{
      chain1: string;
      chain2: string;
      equivalency: number;
      substitutable: boolean;
    }>;
  }>;
  clusters: Array<{
    tier: string;
    chains: string[];
    averageScore: number;
  }>;
}

export default function SovereignTrustPage() {
  const [trust, setTrust] = useState<SovereignTrust | null>(null);
  const [loading, setLoading] = useState(false);
  const [chainIds, setChainIds] = useState('');

  const fetchTrust = async () => {
    if (!chainIds) return;
    setLoading(true);
    try {
      const ids = chainIds.split(',').map(id => id.trim()).filter(Boolean);
      const res = await fetch(`/api/sovereign-trust?chains=${ids.join(',')}`);
      const data = await res.json();
      setTrust(data);
    } catch (error) {
      console.error('Failed to fetch sovereign trust:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Multi-Chain Sovereign Trust Matrix</h1>
        <p className="text-muted-foreground mt-2">
          Determine which chains are "sovereign sources of trust" and how trust flows across them
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chain IDs</CardTitle>
          <CardDescription>Enter chain IDs (comma-separated) to view trust matrix</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="text"
              value={chainIds}
              onChange={(e) => setChainIds(e.target.value)}
              placeholder="Enter chain IDs (e.g., substrate,evm,cosmos)"
              className="flex-1 px-3 py-2 border rounded-md"
            />
            <button
              onClick={fetchTrust}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Load
            </button>
          </div>
        </CardContent>
      </Card>

      {loading && <div className="text-center py-8">Loading...</div>}

      {trust && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Trust Clusters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trust.clusters.map((cluster, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <Badge variant={cluster.tier === 'high' ? 'default' : cluster.tier === 'medium' ? 'secondary' : 'outline'}>
                        {cluster.tier.toUpperCase()} TIER
                      </Badge>
                      <Badge variant="outline">Avg: {cluster.averageScore.toFixed(1)}</Badge>
                    </div>
                    <div className="mt-2">
                      <div className="text-sm font-semibold mb-1">Chains:</div>
                      <div className="flex flex-wrap gap-2">
                        {cluster.chains.map((chain, cIdx) => (
                          <Badge key={cIdx} variant="outline">{chain}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Chain Trust Scores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trust.chains.map((chain, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold">{chain.chainId}</span>
                      <div className="flex gap-2">
                        <Badge variant={chain.trustScore.score >= 80 ? 'default' : chain.trustScore.score >= 60 ? 'secondary' : 'outline'}>
                          {chain.trustScore.score}/100
                        </Badge>
                        <Badge variant="outline">
                          {Math.round(chain.trustScore.sovereignty * 100)}% sovereignty
                        </Badge>
                      </div>
                    </div>
                    {chain.trustScore.factors.length > 0 && (
                      <div className="mt-2">
                        <div className="text-sm font-semibold mb-1">Factors:</div>
                        <div className="flex flex-wrap gap-2">
                          {chain.trustScore.factors.map((factor, fIdx) => (
                            <Badge key={fIdx} variant="outline">{factor}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mt-2">
                      <div className="text-sm font-semibold mb-1">Drift:</div>
                      <Badge variant={chain.drift.drift > 0 ? 'destructive' : 'default'}>
                        {chain.drift.drift > 0 ? '+' : ''}{Math.round(chain.drift.drift * 100)}%
                      </Badge>
                    </div>
                    {chain.equivalencies.length > 0 && (
                      <div className="mt-4">
                        <div className="text-sm font-semibold mb-2">Equivalencies:</div>
                        <div className="space-y-1">
                          {chain.equivalencies.slice(0, 3).map((equiv, eIdx) => (
                            <div key={eIdx} className="flex justify-between items-center text-sm">
                              <span>{equiv.chain2}</span>
                              <div className="flex gap-2">
                                <Badge variant={equiv.substitutable ? 'default' : 'outline'}>
                                  {Math.round(equiv.equivalency * 100)}%
                                </Badge>
                                {equiv.substitutable && (
                                  <Badge variant="secondary">Substitutable</Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}








