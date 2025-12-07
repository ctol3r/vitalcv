'use client';

import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, CheckCircle2, FileDown, Loader2, Plus, RefreshCw, Shield } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface PrivilegePack {
  id: string;
  name: string;
  orgId: string;
  rules: unknown;
}

interface SimulationResult {
  evaluation: {
    eligible: boolean;
    missingRequirements: string[];
    satisfied: string[];
  };
  clinicianId: string;
}

interface PacketResult {
  packet: {
    packetId: string;
    evaluation: {
      riskCategory: 'green' | 'yellow' | 'red';
      missingRequirements: string[];
      satisfied: string[];
      eligible: boolean;
    };
    audit: {
      anchor: {
        txHash: string;
        timestamp: string;
      };
    };
    pdfBundle?: string;
  };
}

export default function PrivilegePackDetailPage({ params }: { params: { id: string } }) {
  const { toast } = useToast();
  const [pack, setPack] = useState<PrivilegePack | null>(null);
  const [rules, setRules] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clinicianId, setClinicianId] = useState('');
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [packet, setPacket] = useState<PacketResult['packet'] | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/privileges/packs/${params.id}`);
        if (!response.ok) {
          throw new Error(`Pack fetch failed (${response.status})`);
        }
        const payload = (await response.json()) as PrivilegePack;
        setPack(payload);
        setName(payload.name);
        setRules(extractRules(payload.rules));
      } catch (error) {
        toast({
          title: 'Unable to load privilege pack',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id, toast]);

  const riskBadge = useMemo(() => {
    if (!packet) return null;
    const variant =
      packet.evaluation.riskCategory === 'green'
        ? 'outline'
        : packet.evaluation.riskCategory === 'yellow'
          ? 'secondary'
          : 'destructive';
    return (
      <Badge variant={variant} className="gap-1">
        {packet.evaluation.riskCategory.toUpperCase()} RISK
      </Badge>
    );
  }, [packet]);

  const handleSave = async () => {
    if (!pack) return;
    setSaving(true);
    try {
      const body = {
        name,
        rules: buildRulesPayload(rules),
      };
      const response = await fetch(`${API_BASE}/api/privileges/packs/${pack.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error('Save failed');
      }
      const updated = (await response.json()) as PrivilegePack;
      setPack(updated);
      toast({ title: 'Privilege pack updated' });
    } catch (error) {
      toast({
        title: 'Unable to save privilege pack',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSimulate = async () => {
    if (!pack || !clinicianId.trim()) {
      toast({ title: 'Clinician ID required', variant: 'destructive' });
      return;
    }
    setSimulating(true);
    try {
      const response = await fetch(`${API_BASE}/api/privileges/packs/${pack.id}/simulate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clinicianId: clinicianId.trim() }),
      });
      if (!response.ok) {
        throw new Error('Simulation failed');
      }
      const payload = (await response.json()) as SimulationResult;
      setSimulation(payload);
      toast({ title: 'Simulation complete' });
    } catch (error) {
      toast({
        title: 'Simulation error',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSimulating(false);
    }
  };

  const handleExport = async () => {
    if (!pack || !clinicianId.trim()) {
      toast({ title: 'Clinician ID required', variant: 'destructive' });
      return;
    }
    setExporting(true);
    try {
      const response = await fetch(`${API_BASE}/api/privileges/packs/${pack.id}/export`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clinicianId: clinicianId.trim() }),
      });
      if (!response.ok) {
        throw new Error('Packet export failed');
      }
      const payload = (await response.json()) as PacketResult;
      setPacket(payload.packet);
      toast({ title: 'Packet generated', description: `Packet ${payload.packet.packetId}` });
    } catch (error) {
      toast({
        title: 'Export error',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  if (loading || !pack) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>Loading pack…</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{pack.name}</h1>
          <p className="text-muted-foreground">Machine-readable privileging rules, simulations, and packets.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRules((prev) => [...prev, 'BoardCert'])}>
            <Plus className="mr-1 h-4 w-4" />
            Add rule
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Save pack
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
          <CardDescription>
            Tokens map to evaluator logic. Use Experience&gt;5, License:CA, BoardCert, ACLS, Compact.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Privilege pack name"
          />
          {rules.map((rule, index) => (
            <div className="flex gap-2" key={`${rule}-${index}`}>
              <Input
                value={rule}
                onChange={(event) => updateRule(index, event.target.value, setRules)}
                placeholder="Rule token"
              />
              <Button variant="ghost" onClick={() => removeRule(index, setRules)}>
                Remove
              </Button>
            </div>
          ))}
          {rules.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No rules defined yet. Add at least one requirement.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Simulation</CardTitle>
            <CardDescription>
              Run readiness against a clinician graph to verify eligibility.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={clinicianId}
              onChange={(event) => setClinicianId(event.target.value)}
              placeholder="Clinician ID (e.g., cln_123)"
            />
            <div className="flex gap-2">
              <Button onClick={handleSimulate} disabled={simulating}>
                {simulating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Shield className="mr-2 h-4 w-4" />
                )}
                Run simulation
              </Button>
              <Button variant="outline" onClick={handleExport} disabled={exporting}>
                {exporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                Export packet
              </Button>
            </div>
            {simulation ? (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  {simulation.evaluation.eligible ? (
                    <Badge className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Eligible
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Blocked
                    </Badge>
                  )}
                  <span className="text-sm text-muted-foreground">
                    Clinician {simulation.clinicianId}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                    Missing requirements
                  </p>
                  {simulation.evaluation.missingRequirements.length ? (
                    <ul className="list-disc pl-5 text-sm">
                      {simulation.evaluation.missingRequirements.map((rule) => (
                        <li key={rule}>{rule}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      All hard requirements satisfied.
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                    Satisfied
                  </p>
                  <ul className="list-disc pl-5 text-sm">
                    {simulation.evaluation.satisfied.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Run a simulation to view privilege eligibility.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Committee packet</CardTitle>
                <CardDescription>
                  Green/yellow/red classification plus audit anchors.
                </CardDescription>
              </div>
              {riskBadge}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {packet ? (
              <>
                <div className="text-sm">
                  <span className="text-muted-foreground">Packet ID:</span> {packet.packetId}
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Anchored at:</span>{' '}
                  {new Date(packet.audit.anchor.timestamp).toLocaleString()}
                </div>
                {packet.evaluation.missingRequirements.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Missing: {packet.evaluation.missingRequirements.join(', ')}
                  </div>
                )}
                <Textarea
                  value={JSON.stringify(packet.evaluation, null, 2)}
                  readOnly
                  className="min-h-[140px]"
                />
                <Button
                  variant="outline"
                  disabled={!packet.pdfBundle}
                  onClick={() =>
                    packet.pdfBundle && downloadPacket(packet.pdfBundle, packet.packetId)
                  }
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Download JSON bundle
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Generate a packet to view risk classification.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />
      <div className="text-xs text-muted-foreground">
        Pack ID {pack.id} · Org {pack.orgId} · API base {API_BASE}
      </div>
    </div>
  );
}

function extractRules(rules: unknown): string[] {
  if (!rules) return [];
  if (Array.isArray(rules)) {
    return rules.map(String);
  }
  if (typeof rules === 'object') {
    const payload = rules as {
      requires?: unknown[];
      anyOf?: unknown[];
      minExperienceYears?: number;
      allowCompactSubstitution?: boolean;
    };
    const serialized = [
      ...(payload.requires ?? []).map(String),
      ...(payload.anyOf ?? []).map(String),
    ];
    if (typeof payload.minExperienceYears === 'number') {
      serialized.unshift(`Experience>${payload.minExperienceYears}`);
    }
    if (payload.allowCompactSubstitution) {
      serialized.push('Compact');
    }
    return serialized;
  }
  return [];
}

function buildRulesPayload(rules: string[]) {
  const requires: string[] = [];
  let minExperienceYears: number | undefined;
  let allowCompactSubstitution = false;

  rules.forEach((rule) => {
    const token = rule.trim();
    if (!token) return;
    if (token.toLowerCase().startsWith('experience>')) {
      const parsed = Number(token.split('>').pop());
      if (Number.isFinite(parsed)) {
        minExperienceYears = parsed;
      }
      return;
    }
    if (token.toLowerCase() === 'compact') {
      allowCompactSubstitution = true;
      return;
    }
    requires.push(token);
  });

  return {
    requires,
    ...(minExperienceYears ? { minExperienceYears } : {}),
    allowCompactSubstitution,
  };
}

function updateRule(
  index: number,
  value: string,
  setRules: Dispatch<SetStateAction<string[]>>,
) {
  setRules((prev) => prev.map((rule, idx) => (idx === index ? value : rule)));
}

function removeRule(index: number, setRules: Dispatch<SetStateAction<string[]>>) {
  setRules((prev) => prev.filter((_, idx) => idx !== index));
}

function downloadPacket(payload: string, packetId: string) {
  const link = document.createElement('a');
  link.href = `data:application/json;base64,${payload}`;
  link.download = `privilege-packet-${packetId}.json`;
  link.click();
}

