'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileDown, TrendingDown } from 'lucide-react';

interface CompressionAnalytics {
  averageRatio: number;
  methodDistribution: Record<string, number>;
  performance: Array<{
    method: string;
    avgTime: number;
  }>;
}

export default function CompressionPage() {
  const [analytics, setAnalytics] = useState<CompressionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const res = await fetch('/api/compression/analytics');
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to load analytics', error);
    } finally {
      setLoading(false);
    }
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
      <h1 className="text-3xl font-bold">Credential Compression</h1>

      {analytics && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                Compression Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">
                {(analytics.averageRatio * 100).toFixed(1)}%
              </div>
              <p className="text-muted-foreground">Average compression ratio</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Method Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(analytics.methodDistribution).map(([method, count]) => (
                  <div key={method} className="flex items-center justify-between">
                    <Badge variant="outline">{method}</Badge>
                    <span>{count} credentials</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

