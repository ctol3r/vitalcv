'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function ChainReactorPage() {
  const [reactor, setReactor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/chain-consensus-reactor`)
      .then((res) => res.json())
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!reactor) return <div>No chain consensus reactor data</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Chain Integrity Consensus Reactor</CardTitle>
          <CardDescription>A consensus reactor that continuously evaluates chain integrity & feeds trust decisions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Integrity Score</span>
              <span className="text-sm font-bold">{reactor.reactor?.integrityScore?.toFixed(1) || 0}/100</span>
            </div>
            <Progress value={reactor.reactor?.integrityScore || 0} />
          </div>
          <div>
            <Badge variant={reactor.reactor?.health === 'healthy' ? 'default' : reactor.reactor?.health === 'degraded' ? 'secondary' : 'destructive'}>
              Health: {reactor.reactor?.health || 'unknown'}
            </Badge>
          </div>
          {reactor.quorum && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Quorum Status</h3>
              <Badge variant={reactor.quorum.satisfied ? 'default' : 'destructive'}>
                {reactor.quorum.verified}/{reactor.quorum.required} networks verified
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








