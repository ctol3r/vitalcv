'use client';

import { useCallback, useState } from 'react';
import { TrendingUp, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function MobilityLiquidityPage() {
  const [region, setRegion] = useState('US');
  const [index, setIndex] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchIndex = useCallback(async () => {
    if (!region) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/mobility-liquidity/${region}`);
      if (response.ok) {
        const data = await response.json();
        setIndex(data.index);
      }
    } catch (err) {
      console.error('Failed to fetch index', err);
    } finally {
      setLoading(false);
    }
  }, [region]);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Workforce Mobility Liquidity Index</h1>
        <p className="text-muted-foreground">
          A global "liquidity index" showing how fluidly clinicians can move through markets
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liquidity Index</CardTitle>
          <CardDescription>Enter a region to view mobility liquidity index</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Region (e.g., US, EU)"
              className="flex-1"
            />
            <Button onClick={fetchIndex} disabled={!region || loading}>
              Load
            </Button>
          </div>

          {loading && <p className="text-muted-foreground">Loading index...</p>}

          {index && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Liquidity Score</span>
                  <Badge variant={index.score >= 70 ? 'default' : 'secondary'}>
                    {index.score.toFixed(1)}/100
                  </Badge>
                </div>
                <Progress value={index.score} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Readiness</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{index.signals.readiness}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Shortages</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{index.signals.shortages}</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

