'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, ArrowRightLeft, CheckCircle2, HandCoins, Milestone, RefreshCcw } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
const EMPLOYER_ID = process.env.NEXT_PUBLIC_EMPLOYER_ID || 'employer_demo';

interface ContractMilestone {
  key: string;
  label: string;
  completed: boolean;
  completedAt?: string;
  actor?: string;
}

interface EscrowContract {
  id: string;
  clinicianId: string;
  employerId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'locked' | 'released' | 'refunded';
  createdAt: string;
  metadata?: Record<string, unknown>;
  milestones: ContractMilestone[];
}

interface ContractsResponse {
  contracts: EscrowContract[];
}

export default function EscrowDashboard() {
  const { toast } = useToast();
  const [contracts, setContracts] = useState<EscrowContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const [form, setForm] = useState({
    clinicianId: '',
    amount: 2500,
    currency: 'USD',
  });

  useEffect(() => {
    loadContracts();
  }, []);

  const lockedTotal = useMemo(
    () => contracts.filter((contract) => contract.status === 'locked').reduce((sum, contract) => sum + contract.amount, 0),
    [contracts],
  );

  async function loadContracts() {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/escrow/contracts?employerId=${encodeURIComponent(EMPLOYER_ID)}`,
      );
      if (!response.ok) {
        throw new Error(`Failed to load contracts (${response.status})`);
      }
      const payload = (await response.json()) as ContractsResponse;
      setContracts(payload.contracts);
    } catch (error) {
      console.error('[recruiter][escrow] load failed', error);
      toast({
        title: 'Unable to load escrow contracts',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleLock() {
    if (!form.clinicianId.trim()) {
      toast({ title: 'Clinician ID required', variant: 'destructive' });
      return;
    }
    setLocking(true);
    try {
      const response = await fetch(`${API_BASE}/api/escrow/lock`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clinicianId: form.clinicianId.trim(),
          employerId: EMPLOYER_ID,
          amount: Number(form.amount),
          currency: form.currency,
        }),
      });
      if (!response.ok) {
        throw new Error(`Escrow lock failed (${response.status})`);
      }
      const payload = await response.json();
      setContracts((prev) => [payload.contract, ...prev]);
      toast({ title: 'Escrow locked', description: payload.contract.id });
      setForm((prev) => ({ ...prev, clinicianId: '' }));
    } catch (error) {
      console.error('[recruiter][escrow] lock failed', error);
      toast({
        title: 'Unable to lock escrow',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLocking(false);
    }
  }

  async function handleTransition(contractId: string, action: 'release' | 'refund') {
    try {
      const response = await fetch(`${API_BASE}/api/escrow/${contractId}/${action}`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`${action} failed (${response.status})`);
      }
      const payload = await response.json();
      setContracts((prev) => prev.map((contract) => (contract.id === contractId ? payload.contract : contract)));
      toast({ title: `Escrow ${action}d`, description: contractId });
    } catch (error) {
      console.error('[recruiter][escrow] transition failed', error);
      toast({
        title: `Unable to ${action} escrow`,
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }

  async function handleMilestone(contractId: string, milestone: string) {
    try {
      const response = await fetch(`${API_BASE}/api/escrow/${contractId}/milestones`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ milestone, actor: 'recruiter-console' }),
      });
      if (!response.ok) {
        throw new Error(`Milestone update failed (${response.status})`);
      }
      const payload = await response.json();
      setContracts((prev) => prev.map((contract) => (contract.id === contractId ? payload.contract : contract)));
      toast({ title: 'Milestone updated', description: milestone });
    } catch (error) {
      console.error('[recruiter][escrow] milestone failed', error);
      toast({
        title: 'Unable to update milestone',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Recruiter · Escrow</Badge>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Contract escrow</h1>
            <p className="text-muted-foreground">
              Lock offers, track clinician milestones, and release funds when onboarding completes.
            </p>
          </div>
          <Button variant="outline" onClick={loadContracts} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Lock new escrow</CardTitle>
            <CardDescription>Funds remain locked until all milestones complete.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Clinician ID</Label>
              <Input
                value={form.clinicianId}
                onChange={(event) => setForm((prev) => ({ ...prev, clinicianId: event.target.value }))}
                placeholder="cln_123"
              />
            </div>
            <div className="space-y-2">
              <Label>Amount (USD)</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(event) => setForm((prev) => ({ ...prev, amount: Number(event.target.value) }))}
                min={500}
                step={500}
              />
            </div>
            <Button className="w-full" onClick={handleLock} disabled={locking}>
              {locking ? 'Locking…' : 'Lock escrow'}
            </Button>
            <Separator />
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase text-muted-foreground">Locked balance</p>
              <p className="text-2xl font-semibold">${lockedTotal.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Employer {EMPLOYER_ID}</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {contracts.length === 0 && !loading && (
            <Card>
              <CardHeader>
                <CardTitle>No contracts yet</CardTitle>
                <CardDescription>Lock escrow to start a milestone workflow.</CardDescription>
              </CardHeader>
            </Card>
          )}
          {contracts.map((contract) => (
            <ContractCard
              key={contract.id}
              contract={contract}
              onRelease={() => handleTransition(contract.id, 'release')}
              onRefund={() => handleTransition(contract.id, 'refund')}
              onMilestone={(milestone) => handleMilestone(contract.id, milestone)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ContractCard({
  contract,
  onRelease,
  onRefund,
  onMilestone,
}: {
  contract: EscrowContract;
  onRelease: () => void;
  onRefund: () => void;
  onMilestone: (milestone: string) => void;
}) {
  const canRelease = contract.status === 'locked' && contract.milestones.every((milestone) => milestone.completed);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Contract {contract.id}</CardTitle>
          <CardDescription>
            Clinician {contract.clinicianId} · Locked {new Date(contract.createdAt).toLocaleDateString()}
          </CardDescription>
        </div>
        <Badge variant={contract.status === 'locked' ? 'default' : 'outline'} className="gap-1">
          <HandCoins className="h-3.5 w-3.5" />
          {contract.status.toUpperCase()}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>Amount</span>
          <span className="font-semibold text-foreground">
            {contract.currency} {contract.amount.toLocaleString()}
          </span>
          <span>•</span>
          <span>Employer {contract.employerId}</span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {contract.milestones.map((milestone) => (
            <div
              key={milestone.key}
              className="rounded-lg border p-3 text-sm flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                {milestone.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Milestone className="h-4 w-4 text-muted-foreground" />
                )}
                <p className="font-medium">{milestone.label}</p>
              </div>
              {milestone.completed ? (
                <p className="text-xs text-muted-foreground">
                  Completed {milestone.completedAt ? new Date(milestone.completedAt).toLocaleDateString() : ''}
                </p>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onMilestone(milestone.key)}
                  className="justify-start text-xs"
                >
                  Mark complete
                </Button>
              )}
            </div>
          ))}
        </div>
        <Separator />
        <div className="flex flex-wrap gap-2">
          <Button onClick={onRelease} disabled={!canRelease}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Release escrow
          </Button>
          <Button variant="outline" onClick={onRefund}>
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Refund
          </Button>
          {!canRelease && contract.status === 'locked' && (
            <div className="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-900">
              <AlertTriangle className="h-3.5 w-3.5" />
              Awaiting milestone completion
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}











