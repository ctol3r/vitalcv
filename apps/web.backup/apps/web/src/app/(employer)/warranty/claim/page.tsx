'use client';

import { useState } from 'react';
import { AlertCircle, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  '';

type ClaimState = 'idle' | 'submitting' | 'success' | 'error';

interface SettlementResponse {
  decision: 'approved' | 'pending' | 'denied';
  payout: number;
  reasonCodes: string[];
  settledAt: string;
  coverage: number;
  breaches: {
    breaches: Array<{
      type: string;
      severity: string;
      detail: string;
      detectedAt: string;
    }>;
    summary: string;
  };
}

export default function WarrantyClaimPage() {
  const [form, setForm] = useState({
    credentialId: '',
    credentialType: 'license',
    issuerDid: '',
    claimAmount: 25000,
    reason: '',
  });
  const [state, setState] = useState<ClaimState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SettlementResponse | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState('submitting');
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/warranty/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentialId: form.credentialId.trim(),
          credentialType: form.credentialType.trim(),
          issuerDid: form.issuerDid.trim(),
          claimAmount: Number(form.claimAmount),
          reason: form.reason.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'Unable to submit warranty claim');
      }

      const data = (await response.json()) as SettlementResponse;
      setResult(data);
      setState('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
      setState('error');
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Employer · Warranty</Badge>
          <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Protected Credential
          </Badge>
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Submit warranty claim</h1>
          <p className="text-sm text-muted-foreground">
            Anchor claim data against credential coverage before notifying Vital CV underwriting.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Claim details</CardTitle>
          <CardDescription>Provide the credential identifiers and reason to initiate review.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="credentialId">Credential ID</Label>
                <Input
                  id="credentialId"
                  required
                  value={form.credentialId}
                  onChange={(event) => setForm((prev) => ({ ...prev, credentialId: event.target.value }))}
                  placeholder="cred_12345"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="credentialType">Credential type</Label>
                <Input
                  id="credentialType"
                  value={form.credentialType}
                  onChange={(event) => setForm((prev) => ({ ...prev, credentialType: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issuerDid">Issuer DID</Label>
                <Input
                  id="issuerDid"
                  required
                  value={form.issuerDid}
                  onChange={(event) => setForm((prev) => ({ ...prev, issuerDid: event.target.value }))}
                  placeholder="did:web:vitalcv.health/issuer"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="claimAmount">Claim amount</Label>
                <Input
                  id="claimAmount"
                  type="number"
                  min={1}
                  value={form.claimAmount}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, claimAmount: Number(event.target.value) || 0 }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                rows={4}
                placeholder="Describe the breach or suspected false issuance"
                value={form.reason}
                onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              <Button type="submit" disabled={state === 'submitting'}>
                {state === 'submitting' ? 'Submitting...' : 'Submit claim'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Settlement decision</CardTitle>
            <CardDescription>Snapshot of underwriting response</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={result.decision === 'approved' ? 'default' : result.decision === 'denied' ? 'destructive' : 'secondary'}>
                {result.decision.toUpperCase()}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Settled {new Date(result.settledAt).toLocaleString()}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-medium text-muted-foreground">Approved payout</p>
                <p className="text-2xl font-semibold">{formatCurrency(result.payout)}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-medium text-muted-foreground">Coverage remaining</p>
                <p className="text-2xl font-semibold">{formatCurrency(Math.max(result.coverage - result.payout, 0))}</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Breach signals</p>
              <div className="grid gap-2">
                {result.breaches?.breaches?.length ? (
                  result.breaches.breaches.map((breach, index) => (
                    <div
                      key={`${breach.type}-${index}`}
                      className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <span className="font-mono text-xs uppercase">{breach.type}</span>
                      <span className="text-muted-foreground">{breach.detail}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No breaches detected</p>
                )}
              </div>
            </div>
            {result.reasonCodes?.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Reason codes</p>
                  <div className="flex flex-wrap gap-2">
                    {result.reasonCodes.map((code) => (
                      <Badge key={code} variant="outline">
                        {code}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}










