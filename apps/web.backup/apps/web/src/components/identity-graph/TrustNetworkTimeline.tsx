'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Timeline, TrendingUp, Network, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  '';

interface GraphSnapshot {
  id: string;
  version: number;
  trustScore: number;
  networkMetrics: {
    endorsementDensity: number;
    peerStability: number;
    networkRichness: number;
    trustLift: number;
  };
  createdAt: string;
}

interface TrustNetworkTimelineProps {
  clinicianId: string;
  className?: string;
}

export function TrustNetworkTimeline({ clinicianId, className }: TrustNetworkTimelineProps) {
  const [snapshots, setSnapshots] = useState<GraphSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSnapshots = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/api/graph/snapshots/${clinicianId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch snapshots');
        }

        const data = await response.json();
        setSnapshots(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load timeline');
      } finally {
        setLoading(false);
      }
    };

    if (clinicianId) {
      fetchSnapshots();
    }
  }, [clinicianId]);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timeline className="h-5 w-5" />
            Trust Network Timeline
          </CardTitle>
          <CardDescription>Loading network history...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full h-[400px]" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timeline className="h-5 w-5" />
            Trust Network Timeline
          </CardTitle>
          <CardDescription>Error loading timeline</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (snapshots.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timeline className="h-5 w-5" />
            Trust Network Timeline
          </CardTitle>
          <CardDescription>No network history available</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Network snapshots will appear here as your trust network evolves.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Sort by date (newest first)
  const sortedSnapshots = [...snapshots].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timeline className="h-5 w-5" />
          Trust Network Timeline
        </CardTitle>
        <CardDescription>Your trust network over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedSnapshots.map((snapshot, index) => {
            const prevSnapshot = sortedSnapshots[index + 1];
            const trustChange = prevSnapshot
              ? snapshot.trustScore - prevSnapshot.trustScore
              : 0;

            return (
              <div
                key={snapshot.id}
                className="flex gap-4 pb-4 border-b last:border-0 last:pb-0"
              >
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  {index < sortedSnapshots.length - 1 && (
                    <div className="w-0.5 h-full bg-border mt-2" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        Version {snapshot.version}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(snapshot.createdAt), 'MMM d, yyyy HH:mm')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {(snapshot.trustScore * 100).toFixed(1)}%
                      </div>
                      {trustChange !== 0 && (
                        <div
                          className={`text-xs flex items-center gap-1 ${
                            trustChange > 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          <TrendingUp
                            className={`h-3 w-3 ${
                              trustChange < 0 ? 'rotate-180' : ''
                            }`}
                          />
                          {trustChange > 0 ? '+' : ''}
                          {(trustChange * 100).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Endorsement Density</div>
                      <div className="font-medium">
                        {(snapshot.networkMetrics.endorsementDensity * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Peer Stability</div>
                      <div className="font-medium">
                        {(snapshot.networkMetrics.peerStability * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Network Richness</div>
                      <div className="font-medium">
                        {snapshot.networkMetrics.networkRichness.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Trust Lift</div>
                      <div className="font-medium">
                        {snapshot.networkMetrics.trustLift.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}








