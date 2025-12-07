'use client';

import { useEffect, useState } from 'react';
import { Scale, AlertTriangle, RefreshCcw, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

interface BiasSignal {
  type: string;
  pattern: string;
  severity: string;
}

interface ComplianceViolation {
  type: string;
  description: string;
  regulation: string;
}

interface EmployerFairness {
  orgId: string;
  score: number;
  signals?: {
    biasSignals?: BiasSignal[];
    violations?: ComplianceViolation[];
    anomalies?: Array<{ type: string; severity: string }>;
  };
}

export default function FairnessPage() {
  const [fairness, setFairness] = useState<EmployerFairness[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFairness();
  }, []);

  async function loadFairness() {
    setLoading(true);
    try {
      // In real implementation, would fetch list of employers
      // For demo, using sample org IDs
      const orgIds = ['org1', 'org2', 'org3'];
      const results = await Promise.all(
        orgIds.map(async (orgId) => {
          const response = await fetch(`${API_BASE}/api/fairness/${orgId}`);
          if (response.ok) {
            return await response.json();
          }
          return null;
        })
      );
      setFairness(results.filter((r) => r !== null));
    } catch (error) {
      console.error('Failed to load fairness data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(orgId: string) {
    try {
      const response = await fetch(`${API_BASE}/api/fairness/${orgId}/export`);
      if (response.ok) {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fairness-audit-${orgId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export:', error);
    }
  }

  async function handleAnchor(orgId: string) {
    try {
      const response = await fetch(`${API_BASE}/api/fairness/${orgId}/anchor`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        alert(`Anchored! TX: ${data.txHash}`);
      }
    } catch (error) {
      console.error('Failed to anchor:', error);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Admin · Employer Fairness</Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Fairness & Compliance</h1>
            <p className="text-muted-foreground">
              Ensure employer hiring behavior is fair, compliant, and bias-free
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-auto gap-2"
            onClick={loadFairness}
            disabled={loading}
          >
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </header>

      <div className="grid gap-6">
        {fairness.map((emp) => (
          <Card key={emp.orgId}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Organization: {emp.orgId}</CardTitle>
                  <CardDescription>Fairness and compliance score</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleExport(emp.orgId)}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleAnchor(emp.orgId)}>
                    Anchor
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-4xl font-semibold">{emp.score}</span>
                <Badge
                  variant={
                    emp.score >= 80
                      ? 'default'
                      : emp.score >= 60
                        ? 'secondary'
                        : 'destructive'
                  }
                >
                  {emp.score >= 80
                    ? 'Fair'
                    : emp.score >= 60
                      ? 'Moderate'
                      : 'Needs Improvement'}
                </Badge>
              </div>

              {emp.signals?.biasSignals && emp.signals.biasSignals.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Bias Signals
                  </div>
                  {emp.signals.biasSignals.map((signal, idx) => (
                    <div key={idx} className="rounded-lg border border-amber-300 p-2">
                      <div className="text-sm font-semibold">{signal.pattern}</div>
                      <Badge
                        variant={
                          signal.severity === 'high'
                            ? 'destructive'
                            : signal.severity === 'medium'
                              ? 'secondary'
                              : 'outline'
                        }
                        className="mt-1"
                      >
                        {signal.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {emp.signals?.violations && emp.signals.violations.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="font-semibold flex items-center gap-2">
                    <Scale className="h-4 w-4 text-red-600" />
                    Compliance Violations
                  </div>
                  {emp.signals.violations.map((violation, idx) => (
                    <div key={idx} className="rounded-lg border border-red-300 p-2">
                      <div className="text-sm font-semibold">{violation.description}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Regulation: {violation.regulation}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

