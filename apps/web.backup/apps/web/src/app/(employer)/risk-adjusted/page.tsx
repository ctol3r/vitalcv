'use client';

import { useEffect, useState } from 'react';
import { RefreshCcw, AlertTriangle, TrendingUp } from 'lucide-react';
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
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

interface RiskAdjustedHiringData {
  candidates: Array<{
    clinicianId: string;
    readiness: number;
    safety: number;
    trust: number;
    reliability: number;
    performance: number;
    overallScore: number;
  }>;
  riskVectors: Array<{
    clinicianId: string;
    riskFactors: string[];
    riskScore: number;
  }>;
  mitigationSuggestions: Array<{
    clinicianId: string;
    suggestions: string[];
  }>;
}

export default function RiskAdjustedHiringPage() {
  const [data, setData] = useState<RiskAdjustedHiringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgId] = useState('demo_org_123');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/risk-adjusted-hiring/${orgId}`);
      if (res.ok) {
        const hiring = await res.json();
        setData(hiring);
      }
    } catch (error) {
      console.error('Failed to load risk-adjusted hiring:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Employer · Risk-Adjusted Hiring</Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Risk-Adjusted Hiring Engine</h1>
            <p className="text-muted-foreground">
              Hiring recommendations weighted by risk, safety, trust, performance & compliance
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-auto gap-2"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </header>

      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Ranked Candidates</CardTitle>
              <CardDescription>Risk-adjusted candidate rankings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.candidates.map((candidate, idx) => {
                  const riskVector = data.riskVectors.find(r => r.clinicianId === candidate.clinicianId);
                  const mitigation = data.mitigationSuggestions.find(m => m.clinicianId === candidate.clinicianId);

                  return (
                    <div key={idx} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-semibold">Candidate #{idx + 1}</div>
                          <div className="text-sm text-muted-foreground">{candidate.clinicianId}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-semibold">{candidate.overallScore}%</div>
                          <Badge variant={candidate.overallScore > 80 ? 'default' : 'secondary'}>
                            {candidate.overallScore > 80 ? 'High' : candidate.overallScore > 60 ? 'Medium' : 'Low'}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-5 gap-2 mb-3">
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">Readiness</div>
                          <div className="font-semibold">{candidate.readiness}%</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">Safety</div>
                          <div className="font-semibold">{candidate.safety}%</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">Trust</div>
                          <div className="font-semibold">{candidate.trust}%</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">Reliability</div>
                          <div className="font-semibold">{candidate.reliability}%</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">Performance</div>
                          <div className="font-semibold">{candidate.performance}%</div>
                        </div>
                      </div>

                      {riskVector && riskVector.riskScore > 0 && (
                        <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-2">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                            <span className="text-sm font-semibold">Risk Score: {riskVector.riskScore}%</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {riskVector.riskFactors.join(', ')}
                          </div>
                        </div>
                      )}

                      {mitigation && mitigation.suggestions.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          <strong>Mitigation:</strong> {mitigation.suggestions.join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-12">
          <RefreshCcw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

