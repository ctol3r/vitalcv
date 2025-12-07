'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Activity } from 'lucide-react';

interface MarketLiquidity {
  liquidity: number;
  supply: number;
  demand: number;
  imbalance: number;
}

interface MarketplaceHealth {
  health: number;
  metrics: {
    liquidity: number;
    responseRate: number;
    conversionRate: number;
  };
}

export default function LiquidityPage() {
  const [liquidity, setLiquidity] = useState<MarketLiquidity | null>(null);
  const [health, setHealth] = useState<MarketplaceHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('nurse');
  const [region, setRegion] = useState('CA');

  useEffect(() => {
    loadLiquidity();
  }, [role, region]);

  const loadLiquidity = async () => {
    try {
      setLoading(true);
      const [liquidityRes, healthRes] = await Promise.all([
        fetch(`/api/marketplace/liquidity/market/${role}/${region}`),
        fetch(`/api/marketplace/liquidity/health/${region}`),
      ]);

      if (liquidityRes.ok) {
        const data = await liquidityRes.json();
        setLiquidity(data);
      }

      if (healthRes.ok) {
        const data = await healthRes.json();
        setHealth(data);
      }
    } catch (error) {
      console.error('Failed to load liquidity', error);
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (health: number) => {
    if (health >= 0.7) return 'text-green-600';
    if (health >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Marketplace Liquidity</h1>

      {liquidity && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Market Liquidity
            </CardTitle>
            <CardDescription>{role} in {region}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold">{liquidity.liquidity.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Liquidity Index</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{liquidity.imbalance}</div>
                <div className="text-sm text-muted-foreground">Imbalance</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{liquidity.supply}</div>
                <div className="text-sm text-muted-foreground">Supply</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{liquidity.demand}</div>
                <div className="text-sm text-muted-foreground">Demand</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {health && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Marketplace Health
            </CardTitle>
            <CardDescription>{region}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold mb-4" style={{ color: getHealthColor(health.health) }}>
              {(health.health * 100).toFixed(1)}%
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Liquidity:</span>
                <span>{(health.metrics.liquidity * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Response Rate:</span>
                <span>{(health.metrics.responseRate * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Conversion Rate:</span>
                <span>{(health.metrics.conversionRate * 100).toFixed(1)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

