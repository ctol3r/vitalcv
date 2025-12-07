'use client';

import { useEffect, useMemo, useState } from 'react';
import { Ban, CalendarClock, CheckCircle2, ClipboardList, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
const ORG_ID = process.env.NEXT_PUBLIC_ISSUER_ORG_ID || 'org_demo';

type EmergencyReason = 'disaster' | 'surge' | 'shortage';

interface EmergencyPrivilege {
  id: string;
  clinicianId: string;
  orgId: string;
  reason: EmergencyReason;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
  metadata?: Record<string, unknown> | null;
}

interface EligibilityResponse {
  eligible: boolean;
  rationale: string[];
  license: { ok: boolean; rationale: string; status: string; expiresAt?: string | null };
  sanctions: { ok: boolean; rationale: string };
}

interface IssueResponse {
  privilege: EmergencyPrivilege;
  eligibility: EligibilityResponse;
}

const REASONS: Array<{ value: EmergencyReason; label: string; helper: string }> = [
  { value: 'disaster', label: 'Disaster', helper: 'Severe weather or declared emergency' },
  { value: 'surge', label: 'Surge', helper: 'Unexpected patient surge capacity' },
  { value: 'shortage', label: 'Shortage', helper: 'Staffing shortage or critical gap' },
];

export default function EmergencyPrivilegesDashboard() {
  const { toast } = useToast();
  const [privileges, setPrivileges] = useState<EmergencyPrivilege[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [clinicianId, setClinicianId] = useState('');
  const [reason, setReason] = useState<EmergencyReason>('disaster');
  const [durationDays, setDurationDays] = useState(14);

  useEffect(() => {
    loadPrivileges();
  }, []);

  const activePrivileges = useMemo(
    () => privileges.filter((privilege) => !privilege.revokedAt),
    [privileges],
  );

  async function loadPrivileges() {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/privileges/emergency?orgId=${encodeURIComponent(ORG_ID)}`,
      );
      if (!response.ok) {
        throw new Error(`Failed to load privileges (${response.status})`);
      }
      const payload = (await response.json()) as { privileges: EmergencyPrivilege[] };
      setPrivileges(payload.privileges);
    } catch (error) {
      console.error('[issuer][emergencyPrivileges] load failed', error);
      toast({
        title: 'Unable to load emergency privileges',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleIssue() {
    if (!clinicianId.trim()) {
      toast({ title: 'Clinician ID required', variant: 'destructive' });
      return;
    }
    setIssuing(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + durationDays);
      const response = await fetch(`${API_BASE}/api/privileges/emergency/issue`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clinicianId: clinicianId.trim(),
          orgId: ORG_ID,
          reason,
          expiresAt: expiresAt.toISOString(),
          issuedBy: 'issuer-console',
        }),
      });
      if (response.status === 409) {
        const payload = await response.json();
        toast({
          title: 'Eligibility failed',
          description: payload.eligibility
            ? payload.eligibility.rationale.join(' • ')
            : payload.error,
          variant: 'destructive',
        });
        return;
      }
      if (!response.ok) {
        throw new Error(`Emergency issue failed (${response.status})`);
      }
      const payload = (await response.json()) as IssueResponse;
      setPrivileges((prev) => [payload.privilege, ...prev]);
      toast({
        title: 'Emergency privilege issued',
        description: payload.eligibility.rationale.join(' • '),
      });
      setClinicianId('');
    } catch (error) {
      console.error('[issuer][emergencyPrivileges] issue failed', error);
      toast({
        title: 'Unable to issue privilege',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIssuing(false);
    }
  }

  async function handleRevoke(privilegeId: string) {
    try {
      const response = await fetch(
        `${API_BASE}/api/privileges/emergency/${encodeURIComponent(privilegeId)}/revoke`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ revokedBy: 'issuer-console' }),
        },
      );
      if (!response.ok) {
        throw new Error(`Revoke failed (${response.status})`);
      }
      const payload = await response.json();
      setPrivileges((prev) => prev.map((item) => (item.id === privilegeId ? payload.privilege : item)));
      toast({ title: 'Privilege revoked', description: privilegeId });
    } catch (error) {
      console.error('[issuer][emergencyPrivileges] revoke failed', error);
      toast({
        title: 'Unable to revoke privilege',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Issuer · Emergency pathway</Badge>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Emergency privileges</h1>
            <p className="text-muted-foreground">
              Disaster, surge, and staffing shortage pathways with auto-expiry controls.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Issue emergency privilege</CardTitle>
            <CardDescription>Validated license + clean sanctions required.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Clinician ID</Label>
              <Input
                value={clinicianId}
                onChange={(event) => setClinicianId(event.target.value)}
                placeholder="cln_12345"
              />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={(value: EmergencyReason) => setReason(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((option) => (
                    <SelectItem value={option.value} key={option.value}>
                      <div>
                        <p className="font-medium">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.helper}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duration (days)</Label>
              <Input
                type="number"
                min={1}
                max={120}
                value={durationDays}
                onChange={(event) => setDurationDays(Number(event.target.value))}
              />
            </div>
            <Button className="w-full" onClick={handleIssue} disabled={issuing}>
              {issuing ? 'Issuing…' : 'Issue emergency privilege'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Board certification and experience checks are automatically relaxed for emergency requests.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Active emergency privileges</CardTitle>
              <CardDescription>{activePrivileges.length} currently active at {ORG_ID}.</CardDescription>
            </div>
            <Button variant="outline" onClick={loadPrivileges} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh list'}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {activePrivileges.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">No active emergency privileges.</p>
            )}
            {activePrivileges.map((privilege) => (
              <EmergencyPrivilegeRow
                key={privilege.id}
                privilege={privilege}
                onRevoke={() => handleRevoke(privilege.id)}
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmergencyPrivilegeRow({
  privilege,
  onRevoke,
}: {
  privilege: EmergencyPrivilege;
  onRevoke: () => void;
}) {
  const expiresIn = useMemo(() => {
    const expiresAt = new Date(privilege.expiresAt).getTime();
    const diffHours = (expiresAt - Date.now()) / (1000 * 60 * 60);
    return Math.max(Math.floor(diffHours), 0);
  }, [privilege.expiresAt]);

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Clinician {privilege.clinicianId}</p>
          <p className="text-xs text-muted-foreground">
            Issued {new Date(privilege.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <ClipboardList className="h-3.5 w-3.5" />
            {privilege.reason}
          </Badge>
          <Badge className="gap-1 bg-amber-100 text-amber-800">
            <Clock className="h-3 w-3" />
            {expiresIn}h left
          </Badge>
        </div>
      </div>
      <Separator className="my-3" />
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            License + sanction checks cleared
          </p>
          <p className="flex items-center gap-1">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            Expires {new Date(privilege.expiresAt).toLocaleString()}
          </p>
        </div>
        <Button variant="destructive" onClick={onRevoke} className="self-start">
          <Ban className="mr-2 h-4 w-4" />
          Revoke
        </Button>
      </div>
    </div>
  );
}


