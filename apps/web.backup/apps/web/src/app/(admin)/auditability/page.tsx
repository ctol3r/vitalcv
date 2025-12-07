'use client';

import { useEffect, useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, RefreshCcw, Download, Anchor } from 'lucide-react';
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

interface AuditTrail {
  actor: string;
  action: string;
  timestamp: string;
  target: string;
  chainHash?: string;
}

interface AuditabilityData {
  trails: AuditTrail[];
  anomalies: Array<{ type: string; severity: string; description: string }>;
  summaries: Array<{ period: string; summary: string }>;
  compliance: {
    score: number;
    violations: Array<{ rule: string; severity: string }>;
  };
}

export default function AuditabilityPage() {
  const [auditability, setAuditability] = useState<AuditabilityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAuditability();
  }, []);

  async function loadAuditability() {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auditability`);
      if (response.ok) {
        const data = await response.json();
        setAuditability(data);
      }
    } catch (error) {
      console.error('Failed to load auditability data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnchor() {
    try {
      const response = await fetch(`${API_BASE}/api/auditability/anchor`, {
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

  async function handleExport() {
    if (!auditability) return;
    try {
      const blob = new Blob([JSON.stringify(auditability, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-bundle-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export:', error);
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Auditability Kernel</h1>
          <p className="text-muted-foreground mt-2">
            End-to-end auditability with cryptographic proof
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadAuditability} variant="outline" disabled={loading}>
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          {auditability && (
            <>
              <Button onClick={handleExport} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button onClick={handleAnchor} variant="outline">
                <Anchor className="h-4 w-4 mr-2" />
                Anchor
              </Button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <RefreshCcw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          </CardContent>
        </Card>
      ) : auditability ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{auditability.compliance.score.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {auditability.compliance.violations.length} violations
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Audit Trails</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{auditability.trails.length}</div>
                <div className="text-sm text-muted-foreground mt-1">Total events</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Anomalies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{auditability.anomalies.length}</div>
                <div className="text-sm text-muted-foreground mt-1">Detected</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Summaries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{auditability.summaries.length}</div>
                <div className="text-sm text-muted-foreground mt-1">Periods</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Audit Trails</CardTitle>
              <CardDescription>Who did what, when, why</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {auditability.trails.slice(0, 20).map((trail, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Shield className="h-4 w-4 text-blue-500" />
                    <div className="flex-1">
                      <div className="font-medium">{trail.action}</div>
                      <div className="text-sm text-muted-foreground">
                        {trail.actor} → {trail.target} • {new Date(trail.timestamp).toLocaleString()}
                      </div>
                    </div>
                    {trail.chainHash ? (
                      <Badge variant="default">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Unverified</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {auditability.anomalies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Audit Anomalies</CardTitle>
                <CardDescription>Missing, altered, or ambiguous events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {auditability.anomalies.map((anomaly, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-center gap-3 p-3 border rounded-lg',
                        anomaly.severity === 'high' ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'
                      )}
                    >
                      <AlertTriangle
                        className={cn(
                          'h-4 w-4',
                          anomaly.severity === 'high' ? 'text-red-600' : 'text-yellow-600'
                        )}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{anomaly.type}</div>
                        <div className="text-sm text-muted-foreground">{anomaly.description}</div>
                      </div>
                      <Badge variant={anomaly.severity === 'high' ? 'destructive' : 'secondary'}>
                        {anomaly.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {auditability.compliance.violations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Compliance Violations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {auditability.compliance.violations.map((violation, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg border-red-200 bg-red-50">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <div className="flex-1">
                        <div className="font-medium">{violation.rule}</div>
                      </div>
                      <Badge variant="destructive">{violation.severity}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Audit Summaries</CardTitle>
              <CardDescription>Narrative explanations of audit trails</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {auditability.summaries.slice(0, 10).map((summary, idx) => (
                  <div key={idx} className="p-3 border rounded-lg">
                    <div className="font-medium">{summary.period}</div>
                    <div className="text-sm text-muted-foreground mt-1">{summary.summary}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No auditability data available
          </CardContent>
        </Card>
      )}
    </div>
  );
}

