'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpRight, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  PRIVILEGE_CONFLICTS,
  getPrivilegeByCode,
} from '@/data/privileges';

interface PrivilegeAuditEvent {
  id: string;
  timestamp: string;
  clinician: string;
  privilegeCode: string;
  action: 'assigned' | 'revoked' | 'override';
  reviewer: string;
  severity: 'info' | 'warning' | 'critical';
  site: string;
  anchor: {
    txHash: string;
    merkleRoot: string;
    network: string;
  };
  diff: {
    additions: string[];
    removals: string[];
  };
  notes: string;
}

const AUDIT_EVENTS: PrivilegeAuditEvent[] = [
  {
    id: 'audit-001',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    clinician: 'Dr. Priya Raman',
    privilegeCode: 'STRUCT-410',
    action: 'assigned',
    reviewer: 'E. Alvarez',
    severity: 'info',
    site: 'NYC-001',
    anchor: {
      txHash: '0xa1d9...34b1',
      merkleRoot: '0x8b77f8309153392b92a0a5e6d3412f1bd96f22d1d7096fd160a8d03c25f6bb41',
      network: 'pilot-l2',
    },
    diff: {
      additions: ['STRUCT-410', 'ROBOT-500'],
      removals: [],
    },
    notes: 'Auto-propagated after committee approval.',
  },
  {
    id: 'audit-002',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    clinician: 'Dr. Max Chen',
    privilegeCode: 'ROBOT-500',
    action: 'override',
    reviewer: 'J. Patel',
    severity: 'warning',
    site: 'PA-003',
    anchor: {
      txHash: '0x7c2b...994d',
      merkleRoot: '0x4d0f3b944525a6b3420d4fa344ff97a00e741b93a5d64075acbf92f50cb6f798',
      network: 'pilot-l2',
    },
    diff: {
      additions: [],
      removals: ['ROBOT-500'],
    },
    notes: 'Conflict with pediatric call coverage triggered manual hold.',
  },
  {
    id: 'audit-003',
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    clinician: 'Dr. Alisha Lopez',
    privilegeCode: 'CORE-100',
    action: 'revoked',
    reviewer: 'S. Ndoye',
    severity: 'critical',
    site: 'NJ-002',
    anchor: {
      txHash: '0xd91e...ab09',
      merkleRoot: '0x1e8645f76c983e52ab359cf5aeb92bd249ba37e061010f166ddc537c6217344e',
      network: 'pilot-l2',
    },
    diff: {
      additions: [],
      removals: ['CORE-100'],
    },
    notes: 'FPPE failure flagged; privileges paused pending remediation.',
  },
];

export default function PrivilegeAuditDashboard() {
  const [selectedEvent, setSelectedEvent] = useState<PrivilegeAuditEvent>(AUDIT_EVENTS[0]);
  const [query, setQuery] = useState('');

  const filteredEvents = useMemo(() => {
    if (!query) return AUDIT_EVENTS;
    return AUDIT_EVENTS.filter(
      (event) =>
        event.clinician.toLowerCase().includes(query.toLowerCase()) ||
        event.privilegeCode.toLowerCase().includes(query.toLowerCase()) ||
        event.site.toLowerCase().includes(query.toLowerCase()),
    );
  }, [query]);

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Admin · Privilege audit</p>
        <h1 className="text-3xl font-bold">Chain-anchored privilege audit trail</h1>
        <p className="max-w-3xl text-muted-foreground">
          Inspect privilege assignments across the system, reconcile auto-propagation against bylaws, and export anchor
          proofs for regulators or MEC review.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Anchored events (24h)" value="128" description="+18% vs prior day" tone="default" />
        <StatCard label="Manual overrides" value="7" description="Triggered by conflict policy" tone="warning" />
        <StatCard label="Critical revocations" value="2" description="Auto-paused by safety feed" tone="destructive" />
        <StatCard label="Sites with drift" value="3" description="Awaiting policy alignment" tone="secondary" />
      </section>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>Event stream</CardTitle>
            <CardDescription>Anchored privilege events filtered by clinician, site, or conflict.</CardDescription>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Search clinician, site, or privilege"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="sm:w-72"
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Clinician</TableHead>
                <TableHead>Privilege</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Severity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.map((event) => (
                <TableRow
                  key={event.id}
                  className={selectedEvent.id === event.id ? 'bg-muted/50' : 'cursor-pointer'}
                  onClick={() => setSelectedEvent(event)}
                >
                  <TableCell>{new Date(event.timestamp).toLocaleString()}</TableCell>
                  <TableCell className="font-medium">{event.clinician}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{event.privilegeCode}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {getPrivilegeByCode(event.privilegeCode)?.name ?? '—'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{event.site}</TableCell>
                  <TableCell className="capitalize">{event.action}</TableCell>
                  <TableCell>
                    <SeverityBadge severity={event.severity} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Event detail</CardTitle>
            <CardDescription>Diff, reviewer context, and anchor proof for the selected event.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="outline">{selectedEvent.action.toUpperCase()}</Badge>
              <Badge>{selectedEvent.site}</Badge>
              <SeverityBadge severity={selectedEvent.severity} />
              <p className="text-muted-foreground">{new Date(selectedEvent.timestamp).toLocaleString()}</p>
            </div>

            <div className="rounded-lg border p-3 text-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Reviewer</p>
              <p className="font-semibold">{selectedEvent.reviewer}</p>
              <p className="text-muted-foreground">{selectedEvent.notes}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <DiffList label="Additions" values={selectedEvent.diff.additions} tone="default" />
              <DiffList label="Removals" values={selectedEvent.diff.removals} tone="destructive" />
            </div>

            <div className="rounded-lg border p-3 text-sm font-mono">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Anchor proof</p>
              <p className="truncate">{selectedEvent.anchor.txHash}</p>
              <p className="truncate">{selectedEvent.anchor.merkleRoot}</p>
              <div className="mt-2 flex items-center justify-between">
                <Badge variant="secondary">{selectedEvent.anchor.network}</Badge>
                <Button variant="ghost" size="sm" className="gap-1 text-primary">
                  Copy proof
                  <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Policy anomalies</CardTitle>
            <CardDescription>Conflicts detected by the safety engine this week.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {PRIVILEGE_CONFLICTS.slice(0, 3).map((conflict) => (
              <div key={conflict.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{conflict.id}</p>
                  <Badge variant="destructive">{conflict.severity}</Badge>
                </div>
                <p className="text-muted-foreground">{conflict.reason}</p>
              </div>
            ))}
            <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">
              Conflicts auto-sync with propagation engine; manual overrides are highlighted for final review.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  description,
  tone,
}: {
  label: string;
  value: string;
  description: string;
  tone: 'default' | 'warning' | 'destructive' | 'secondary';
}) {
  const styleMap: Record<typeof tone, string> = {
    default: 'border-slate-200 bg-slate-50 text-slate-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    destructive: 'border-rose-200 bg-rose-50 text-rose-900',
    secondary: 'border-indigo-200 bg-indigo-50 text-indigo-900',
  };
  return (
    <div className={`rounded-lg border p-4 ${styleMap[tone]}`}>
      <p className="text-xs uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm">{description}</p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: PrivilegeAuditEvent['severity'] }) {
  const map: Record<PrivilegeAuditEvent['severity'], { label: string; className: string }> = {
    info: { label: 'Info', className: 'bg-slate-100 text-slate-900' },
    warning: { label: 'Warning', className: 'bg-amber-100 text-amber-900' },
    critical: { label: 'Critical', className: 'bg-rose-100 text-rose-900' },
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[severity].className}`}>{map[severity].label}</span>;
}

function DiffList({
  label,
  values,
  tone,
}: {
  label: string;
  values: string[];
  tone: 'default' | 'destructive';
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      {values.length === 0 ? (
        <p className="text-sm text-muted-foreground">No entries</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {values.map((value) => (
            <li key={value} className={`rounded-md px-2 py-1 ${tone === 'destructive' ? 'bg-rose-50 text-rose-900' : 'bg-emerald-50 text-emerald-900'}`}>
              {value}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


