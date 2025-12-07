'use client';

import { useState, useEffect } from 'react';
import { Radar, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

export default function SafetyRadarPage() {
  const [orgId, setOrgId] = useState('');
  const [radar, setRadar] = useState<any>(null);
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadRadar() {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/safety-radar/${orgId}`);
      if (res.ok) {
        const data = await res.json();
        setRadar(data);
      }
    } catch (error) {
      console.error('Failed to load radar:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadRiskScore() {
    if (!orgId) return;
    try {
      const res = await fetch(`${API_BASE}/api/safety-radar/${orgId}/risk-score`);
      if (res.ok) {
        const data = await res.json();
        setRiskScore(data.score);
      }
    } catch (error) {
      console.error('Failed to load risk score:', error);
    }
  }

  useEffect(() => {
    if (orgId) {
      loadRadar();
      loadRiskScore();
    }
  }, [orgId]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Admin · Safety Radar</Badge>
        <div>
          <h1 className="text-3xl font-semibold leading-tight">Employer Safety & Compliance Radar</h1>
          <p className="text-muted-foreground">
            A radar system that monitors employer behavior, safety, risk, and compliance maturity
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Safety Compliance Radar</CardTitle>
          <CardDescription>Monitor employer safety and compliance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Organization ID"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className="flex-1 rounded-md border px-3 py-2"
            />
            <Button onClick={loadRadar} disabled={loading || !orgId}>
              <Radar className="h-4 w-4 mr-2" />
              Load Radar
            </Button>
          </div>
          {riskScore !== null && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Risk Score</span>
                <span className="text-sm">{riskScore}/100</span>
              </div>
              <Progress value={riskScore} />
            </div>
          )}
        </CardContent>
      </Card>

      {radar && radar.radar && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Risk Score</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{radar.radar.riskScore || 0}</p>
              <p className="text-sm text-muted-foreground">0-100 scale</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Safety Score</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{radar.radar.safetyScore || 0}</p>
              <p className="text-sm text-muted-foreground">0-100 scale</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Compliance Score</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{radar.radar.complianceScore || 0}</p>
              <p className="text-sm text-muted-foreground">0-100 scale</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

