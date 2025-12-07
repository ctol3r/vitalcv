'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shield, Globe, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function TrustArchitecturePage() {
  const [issuerId, setIssuerId] = useState('');
  const [chainName, setChainName] = useState('Substrate');
  const [regulatorId, setRegulatorId] = useState('');
  const [employerId, setEmployerId] = useState('');
  const [trust, setTrust] = useState<any>(null);
  const [explanation, setExplanation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveTrust = useCallback(async () => {
    if (!issuerId || !regulatorId || !employerId) return;
    setLoading(true);
    setError(null);
    try {
      const [trustRes, explainRes] = await Promise.all([
        fetch(`${API_BASE}/api/trust-architecture/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issuerId, chainName, regulatorId, employerId }),
        }),
        fetch(`${API_BASE}/api/trust-architecture/explain`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clinicianId: 'clinician-1',
            trustLayer: {
              issuer: { id: issuerId, trustScore: 90, verified: true },
              chain: { name: chainName, trustScore: 85, verified: true },
              regulator: { id: regulatorId, trustScore: 95, verified: true },
              employer: { id: employerId, trustScore: 80, verified: true },
            },
          }),
        }),
      ]);

      if (!trustRes.ok) {
        throw new Error(`Failed to resolve trust (${trustRes.status})`);
      }

      const trustData = await trustRes.json();
      setTrust(trustData);

      if (explainRes.ok) {
        const explainData = await explainRes.json();
        setExplanation(explainData);
      }
    } catch (err) {
      console.error('Failed to resolve trust', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [issuerId, chainName, regulatorId, employerId]);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Global Trust Architecture</h1>
        <p className="text-muted-foreground">
          Unifying all trust systems across chains, countries, issuers, regulators
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resolve Trust Layers</CardTitle>
          <CardDescription>Resolve trust from issuer→chain→regulator→employer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              value={issuerId}
              onChange={(e) => setIssuerId(e.target.value)}
              placeholder="Issuer ID"
            />
            <Input
              value={chainName}
              onChange={(e) => setChainName(e.target.value)}
              placeholder="Chain Name"
            />
            <Input
              value={regulatorId}
              onChange={(e) => setRegulatorId(e.target.value)}
              placeholder="Regulator ID"
            />
            <Input
              value={employerId}
              onChange={(e) => setEmployerId(e.target.value)}
              placeholder="Employer ID"
            />
          </div>

          <Button onClick={resolveTrust} disabled={loading || !issuerId || !regulatorId || !employerId}>
            Resolve Trust
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && <p className="text-muted-foreground">Resolving trust...</p>}

          {trust && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Issuer Trust</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{trust.issuer.trustScore}</div>
                    <Badge variant={trust.issuer.verified ? 'default' : 'secondary'}>
                      {trust.issuer.verified ? 'Verified' : 'Unverified'}
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Chain Trust</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{trust.chain.trustScore}</div>
                    <Badge variant={trust.chain.verified ? 'default' : 'secondary'}>
                      {trust.chain.verified ? 'Verified' : 'Unverified'}
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Regulator Trust</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{trust.regulator.trustScore}</div>
                    <Badge variant={trust.regulator.verified ? 'default' : 'secondary'}>
                      {trust.regulator.verified ? 'Verified' : 'Unverified'}
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Employer Trust</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{trust.employer.trustScore}</div>
                    <Badge variant={trust.employer.verified ? 'default' : 'secondary'}>
                      {trust.employer.verified ? 'Verified' : 'Unverified'}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              {explanation && (
                <Card>
                  <CardHeader>
                    <CardTitle>Trust Explanation</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Overall Trust Score</span>
                        <Badge variant={explanation.overallScore >= 80 ? 'default' : explanation.overallScore >= 60 ? 'secondary' : 'destructive'}>
                          {explanation.overallScore}/100
                        </Badge>
                      </div>
                      <Progress value={explanation.overallScore} />
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">Explanation:</p>
                      <p className="text-sm text-muted-foreground">{explanation.explanation}</p>
                    </div>

                    {explanation.factors && explanation.factors.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Key Factors:</p>
                        <ul className="list-disc list-inside text-sm text-muted-foreground">
                          {explanation.factors.map((factor: string, i: number) => (
                            <li key={i}>{factor}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








