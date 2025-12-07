'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Loader2, ShieldCheck, ShieldAlert, Link, AlertTriangle } from 'lucide-react';

type StepStatus = 'pending' | 'running' | 'completed' | 'failed';

interface VerifyStep {
  id: string;
  label: string;
  status: StepStatus;
  durationMs?: number;
  metadata?: Record<string, any>;
}

interface ChainAnchor {
  txHash: string;
  blockHash?: string;
  network?: string;
  anchoredAt?: string;
}

interface RecruiterAlert {
  id: string;
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

const INITIAL_STEPS: VerifyStep[] = [
  { id: 'oidc-proof', label: 'OIDC4VP proof request', status: 'pending' },
  { id: 'statuslist', label: 'Status list pre-check', status: 'pending' },
  { id: 'on-chain', label: 'On-chain integrity checks', status: 'pending' },
];

export default function RecruiterAutoVerifyPage() {
  const params = useParams<{ id: string }>();
  const [steps, setSteps] = useState<VerifyStep[]>(INITIAL_STEPS);
  const [isVerifying, setIsVerifying] = useState(false);
  const [readinessScore, setReadinessScore] = useState<number | null>(null);
  const [chainAnchor, setChainAnchor] = useState<ChainAnchor | null>(null);
  const [alerts, setAlerts] = useState<RecruiterAlert[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runAutoVerify = async () => {
    setIsVerifying(true);
    setError(null);
    setSteps(INITIAL_STEPS.map((step, index) => (index === 0 ? { ...step, status: 'running' } : step)));

    try {
      const response = await fetch(`/api/recruiter/verify/${params.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Auto verification failed');
      }

      const body = await response.json();
      const mappedSteps: VerifyStep[] = (body.steps ?? []).map((step: any) => ({
        id: step.id,
        label: step.label,
        status: step.status,
        durationMs: step.durationMs,
        metadata: step.metadata,
      }));

      setSteps(mappedSteps);
      setReadinessScore(body.readinessScore);
      setChainAnchor(body.chain ?? body.chainAnchor ?? null);
      setAlerts(body.alerts ?? []);
    } catch (err) {
      console.error('[auto-verify] error', err);
      setError(err instanceof Error ? err.message : 'Unexpected failure');
      setSteps((prev) =>
        prev.map((step) =>
          step.status === 'running' ? { ...step, status: 'failed' } : step,
        ),
      );
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-6 py-10 space-y-8">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">Recruiter • Auto verification</p>
        <h1 className="text-3xl font-semibold tracking-tight">Verification workflow</h1>
        <p className="text-muted-foreground">
          Drive OIDC4VP proof, revocation pre-checks, and on-chain validation in a single action.
        </p>
        <Button onClick={runAutoVerify} disabled={isVerifying} className="mt-2 w-fit">
          {isVerifying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Auto-Verify
            </>
          ) : (
            'Run Auto-Verify'
          )}
        </Button>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Verification failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Verification steps</CardTitle>
          <CardDescription>End-to-end automation telemetry.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {steps.map((step) => (
            <div key={step.id} className="rounded-lg border p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium">{step.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {step.status === 'pending' && 'Awaiting execution'}
                    {step.status === 'running' && 'In progress'}
                    {step.status === 'completed' && 'Completed successfully'}
                    {step.status === 'failed' && 'Failed'}
                  </p>
                </div>
                <Badge
                  variant={
                    step.status === 'completed'
                      ? 'default'
                      : step.status === 'failed'
                      ? 'destructive'
                      : 'secondary'
                  }
                >
                  {step.status === 'completed'
                    ? 'Completed'
                    : step.status === 'failed'
                    ? 'Failed'
                    : step.status === 'running'
                    ? 'Running'
                    : 'Pending'}
                </Badge>
              </div>
              {step.metadata?.anchor && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Anchor: {step.metadata.anchor.txHash.slice(0, 18)} ({step.metadata.anchor.network})
                </p>
              )}
              {typeof step.durationMs === 'number' && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Duration: {step.durationMs} ms
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Readiness score</CardTitle>
            <CardDescription>Auto-calculated from credential confidence.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {readinessScore === null ? (
              <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                Run auto-verify to generate readiness.
              </div>
            ) : (
              <>
                <div className="flex items-end gap-3">
                  <span className="text-4xl font-semibold">
                    {(readinessScore * 100).toFixed(1)}%
                  </span>
                  <Badge variant={readinessScore >= 0.85 ? 'default' : 'secondary'}>
                    {readinessScore >= 0.85 ? 'Ready' : 'Needs review'}
                  </Badge>
                </div>
                <Progress value={readinessScore * 100} />
                <p className="text-xs text-muted-foreground">
                  Includes OIDC proof strength, revocation pre-checks, and chain verification blend.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chain anchor</CardTitle>
            <CardDescription>Latest proof of verification on ledger.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {chainAnchor ? (
              <>
                <div className="rounded-md border p-3 text-sm">
                  <p className="font-medium flex items-center gap-2">
                    <Link className="h-4 w-4" />
                    {chainAnchor.txHash.slice(0, 22)}…
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Block: {chainAnchor.blockHash?.slice(0, 20)}…
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Network: {chainAnchor.network ?? 'pilot-l2'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Anchored: {chainAnchor.anchoredAt ?? 'just now'}
                  </p>
                </div>
                <Badge variant="outline" className="gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Integrity verified
                </Badge>
              </>
            ) : (
              <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                Run auto-verify to capture ledger state.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recruiter alerts</CardTitle>
          <CardDescription>Threshold signals and expiring credentials.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {alerts.length === 0 ? (
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>No alerts</AlertTitle>
              <AlertDescription>Run auto-verify to evaluate readiness signals.</AlertDescription>
            </Alert>
          ) : (
            alerts.map((alert) => (
              <div key={alert.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{alert.message}</p>
                  <Badge
                    variant={
                      alert.severity === 'critical'
                        ? 'destructive'
                        : alert.severity === 'warning'
                        ? 'secondary'
                        : 'outline'
                    }
                    className="gap-1"
                  >
                    {alert.severity === 'critical' && <ShieldAlert className="h-3 w-3" />}
                    {alert.severity === 'warning' && <AlertTriangle className="h-3 w-3" />}
                    {alert.severity === 'info' && <CheckCircle2 className="h-3 w-3" />}
                    {alert.type}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Severity: {alert.severity}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Separator />
    </div>
  );
}










