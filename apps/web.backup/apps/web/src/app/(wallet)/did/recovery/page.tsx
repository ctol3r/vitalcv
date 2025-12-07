'use client';

import React, { useState } from 'react';
import { Shield, KeyRound, LockKeyhole, Anchor } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

type RecoveryMethod = 'email' | 'phone' | 'escrow';

export default function DidRecoveryPage() {
  const { toast } = useToast();
  const [method, setMethod] = useState<RecoveryMethod>('email');
  const [clinicianId, setClinicianId] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, any> | null>(null);

  const handleRecovery = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`${API_BASE}/api/did/recovery`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clinicianId,
          method,
          code,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Recovery failed');
      }
      setResult(payload);
      setStep(4);
      toast({
        title: 'Recovery anchored',
        description: `Chain receipt ${payload.anchor?.txHash ?? 'pending'}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to recover DID';
      setError(message);
      toast({
        title: 'Recovery error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const progress = (step / 4) * 100;

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">DID Recovery</h1>
          <p className="text-muted-foreground">Select a recovery channel, rotate keys, and restore the credential vault.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Step tracker</CardTitle>
          <CardDescription>4-step lifecycle</CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={progress} />
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant={step >= 1 ? 'secondary' : 'outline'}>1. Verify method</Badge>
            <Badge variant={step >= 2 ? 'secondary' : 'outline'}>2. Generate keys</Badge>
            <Badge variant={step >= 3 ? 'secondary' : 'outline'}>3. Restore vault</Badge>
            <Badge variant={step >= 4 ? 'secondary' : 'outline'}>4. Anchor recovery</Badge>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Recovery halted</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <StepCard
          icon={<Shield className="h-5 w-5" />}
          title="1. Verify recovery method"
          description="Email, SMS, or escrow challenge."
          active
        >
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="clinicianId">Clinician ID</Label>
              <Input
                id="clinicianId"
                placeholder="clinician-123"
                value={clinicianId}
                onChange={(event) => setClinicianId(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Recovery method</Label>
              <div className="flex gap-2">
                {(['email', 'phone', 'escrow'] as RecoveryMethod[]).map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant={method === value ? 'default' : 'outline'}
                    onClick={() => {
                      setMethod(value);
                      setStep(1);
                    }}
                  >
                    {value === 'email' ? 'Email' : value === 'phone' ? 'SMS' : 'Escrow'}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                placeholder="e.g. 482913"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                setStep(2);
                handleRecovery();
              }}
              disabled={loading}
            >
              {loading ? 'Recovering…' : 'Start recovery'}
            </Button>
          </div>
        </StepCard>

        <StepCard
          icon={<KeyRound className="h-5 w-5" />}
          title="2. Generate new keys"
          description="Deterministic Ed25519 keypair generated client-side."
          active={step >= 2}
        >
          {result ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                DID: <span className="font-mono text-foreground">{result.did}</span>
              </p>
              <p className="font-mono text-xs break-all text-foreground">
                Secret: {result.recoverySecret}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Waiting for recovery request…</p>
          )}
        </StepCard>

        <StepCard
          icon={<LockKeyhole className="h-5 w-5" />}
          title="3. Restore credential vault"
          description="Wallet credentials rehydrated into secure enclave."
          active={step >= 3}
        >
          {result?.restoredCredentials?.length ? (
            <div className="space-y-1 text-sm text-muted-foreground">
              {result.restoredCredentials.slice(0, 3).map((credential: any) => (
                <div key={credential.credentialId} className="rounded-md border p-2 font-mono text-xs text-foreground">
                  {credential.credentialId}
                </div>
              ))}
              <p>{result.restoredCredentials.length} credentials restored.</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Vault restoration pending.</p>
          )}
        </StepCard>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <Anchor className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle>4. Anchor recovery</CardTitle>
            <CardDescription>On-chain provenance for audit defense</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {result?.anchor ? (
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                Transaction hash:{' '}
                <span className="font-mono text-foreground">{result.anchor.txHash}</span>
              </p>
              <p>Timestamp: {result.anchor.timestamp}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Trigger recovery to anchor a new digest.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StepCard({
  icon,
  title,
  description,
  children,
  active,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Card className={active ? 'border-primary/50 shadow-sm' : undefined}>
      <CardHeader className="flex flex-row items-center gap-3">
        <div className="rounded-full border p-2 text-muted-foreground">{icon}</div>
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}


