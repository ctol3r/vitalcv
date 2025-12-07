'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Shield, TrendingUp, TrendingDown } from 'lucide-react';

interface TrustScore {
  score: number;
  metrics: {
    correctVerification: number;
    misuseFlags: number;
    responseTime: number;
    complianceScore: number;
  };
  factors: Array<{
    factor: string;
    weight: number;
    value: number;
    contribution: number;
  }>;
}

export default function EmployerTrustPage() {
  const [orgId, setOrgId] = useState('');
  const [trust, setTrust] = useState<TrustScore | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/trust/employer/${orgId}/score`);
      if (res.ok) {
        const data = await res.json();
        setTrust(data);
      }
    } catch (error) {
      console.error('Failed to load trust score', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.7) return 'text-green-600';
    if (score >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 0.7) return <Badge className="bg-green-100 text-green-800">Trusted</Badge>;
    if (score >= 0.5) return <Badge className="bg-yellow-100 text-yellow-800">High Compliance</Badge>;
    return <Badge className="bg-red-100 text-red-800">Provisional</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Employer Trust Scoring</h1>

      <Card>
        <CardHeader>
          <CardTitle>Search Organization</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="Organization ID"
            />
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {trust && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Trust Score</span>
                {getScoreBadge(trust.score)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-4" style={{ color: getScoreColor(trust.score) }}>
                {(trust.score * 100).toFixed(1)}%
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Correct Verifications:</span>
                  <span>{trust.metrics.correctVerification.toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Misuse Flags:</span>
                  <span className="text-red-600">{trust.metrics.misuseFlags.toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Response Time:</span>
                  <span>{trust.metrics.responseTime}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Compliance Score:</span>
                  <span>{(trust.metrics.complianceScore * 100).toFixed(1)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Score Factors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {trust.factors.map((factor, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="capitalize">{factor.factor}</span>
                    <div className="flex items-center gap-2">
                      {factor.contribution > 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                      <span>{(factor.contribution * 100).toFixed(1)}%</span>
                    </div>
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

