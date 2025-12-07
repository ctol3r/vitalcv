'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConflictBadge } from '@/components/privileges/ConflictBadge';
import {
  CLINICIAN_PRIVILEGE_PROFILE,
  PRIVILEGE_CONFLICTS,
  PRIVILEGE_NODE_MAP,
  PRIVILEGE_NODES,
  getPrivilegeByCode,
  type PrivilegeNode,
} from '@/data/privileges';

export default function PrivilegeEligibilityPage() {
  const [search, setSearch] = useState('ROBOT-500');
  const privilege = useMemo(() => getPrivilegeByCode(search), [search]);
  const evaluation = useMemo(() => (privilege ? evaluateEligibility(privilege) : null), [privilege]);

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Demo &raquo; Clinician &raquo; Privileges</p>
        <h1 className="text-3xl font-bold">Privilege Eligibility Explorer</h1>
        <p className="text-muted-foreground max-w-3xl">
          Enter a privilege code to see whether Dr. {CLINICIAN_PRIVILEGE_PROFILE.clinicianName} is eligible today,
          which prerequisites are satisfied, and what remediation actions unblock missing criteria.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lookup</CardTitle>
          <CardDescription>Search seeded privileges by code to evaluate readiness.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row">
          <select
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
          >
            {PRIVILEGE_NODES.map((node) => (
              <option key={node.code} value={node.code}>
                {node.code} — {node.name}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={() => setSearch('CARD-320')}>
            Reset to PCI
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Eligibility result</CardTitle>
            <CardDescription>Live evaluation against seeded clinician profile.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!privilege ? (
              <p className="text-sm text-muted-foreground">Select a privilege code to view the analysis.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="secondary">{privilege.code}</Badge>
                  <div>
                    <p className="font-semibold leading-tight">{privilege.name}</p>
                    <p className="text-xs text-muted-foreground">{privilege.description}</p>
                  </div>
                </div>
                {evaluation && (
                  <>
                    <EligibilityBadge status={evaluation.status} />
                    {evaluation.blockingConflicts.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {evaluation.blockingConflicts.map((conflict) => (
                          <ConflictBadge
                            key={conflict.id}
                            privilegeCode={privilege.code}
                            conflictId={conflict.id}
                            label={conflict.severity === 'critical' ? 'Hard stop' : 'Conflict'}
                          />
                        ))}
                      </div>
                    )}
                    <section className="space-y-2">
                      <h3 className="text-sm font-semibold">Prerequisite matrix</h3>
                      <div className="space-y-2 rounded-md border">
                        {privilege.prerequisites.length === 0 ? (
                          <p className="p-3 text-sm text-muted-foreground">No prerequisites captured.</p>
                        ) : (
                          privilege.prerequisites.map((code) => {
                            const status = evaluation.requirementStatus[code];
                            return (
                              <div
                                key={code}
                                className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0"
                              >
                                <div>
                                  <p className="font-medium text-sm">{code}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {PRIVILEGE_NODE_MAP.get(code)?.name ?? 'Refer to matrix entry'}
                                  </p>
                                </div>
                                <StatusPill status={status} />
                              </div>
                            );
                          })
                        )}
                      </div>
                    </section>
                    {evaluation.missing.length > 0 && (
                      <section className="space-y-3">
                        <h3 className="text-sm font-semibold">Missing prerequisites</h3>
                        <ul className="space-y-2">
                          {evaluation.missing.map((code) => (
                            <li key={code} className="rounded-md border p-3 text-sm shadow-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium">{code}</span>
                                {PRIVILEGE_NODE_MAP.get(code)?.remediationActions.length ? (
                                  <Button size="sm" variant="outline" asChild>
                                    <a href={PRIVILEGE_NODE_MAP.get(code)!.remediationActions[0].href}>Start remediation</a>
                                  </Button>
                                ) : (
                                  <Button size="sm" variant="outline" disabled>
                                    No action
                                  </Button>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {PRIVILEGE_NODE_MAP.get(code)?.description ?? 'See privilege matrix for details.'}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {(PRIVILEGE_NODE_MAP.get(code)?.remediationActions ?? []).map((action) => (
                                  <Button key={action.label} asChild size="sm" variant="ghost">
                                    <a href={action.href}>{action.label}</a>
                                  </Button>
                                ))}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clinician profile</CardTitle>
            <CardDescription>Snapshot of satisfied vs pending prerequisites.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <ProfileRow label="Granted" items={CLINICIAN_PRIVILEGE_PROFILE.granted} badge="success" />
            <ProfileRow label="Expiring soon" items={CLINICIAN_PRIVILEGE_PROFILE.expiringSoon} badge="warning" />
            <ProfileRow label="Training in progress" items={CLINICIAN_PRIVILEGE_PROFILE.trainingInProgress} badge="info" />
            <ProfileRow label="Conflict assignments" items={CLINICIAN_PRIVILEGE_PROFILE.conflictAssignments} badge="destructive" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type RequirementStatus = 'complete' | 'expiring' | 'inProgress' | 'missing';

type EligibilityStatus = 'eligible' | 'missing' | 'conflict' | 'unknown';

interface EvaluationResult {
  status: EligibilityStatus;
  missing: string[];
  requirementStatus: Record<string, RequirementStatus>;
  blockingConflicts: typeof PRIVILEGE_CONFLICTS;
}

function evaluateEligibility(privilege: PrivilegeNode): EvaluationResult {
  const granted = new Set(CLINICIAN_PRIVILEGE_PROFILE.granted);
  const expiring = new Set(CLINICIAN_PRIVILEGE_PROFILE.expiringSoon);
  const inProgress = new Set(CLINICIAN_PRIVILEGE_PROFILE.trainingInProgress);

  const requirementStatus: Record<string, RequirementStatus> = {};
  const missing: string[] = [];

  privilege.prerequisites.forEach((code) => {
    if (granted.has(code)) {
      requirementStatus[code] = expiring.has(code) ? 'expiring' : 'complete';
      return;
    }
    if (inProgress.has(code)) {
      requirementStatus[code] = 'inProgress';
      missing.push(code);
      return;
    }
    requirementStatus[code] = 'missing';
    missing.push(code);
  });

  const blockingConflicts = PRIVILEGE_CONFLICTS.filter(
    (conflict) =>
      conflict.privileges.includes(privilege.code) &&
      conflict.privileges.some((code) => CLINICIAN_PRIVILEGE_PROFILE.conflictAssignments.includes(code)),
  );

  let status: EligibilityStatus = 'eligible';
  if (!privilege) {
    status = 'unknown';
  } else if (blockingConflicts.length > 0) {
    status = 'conflict';
  } else if (missing.length > 0) {
    status = 'missing';
  }

  return {
    status,
    missing,
    requirementStatus,
    blockingConflicts,
  };
}

function EligibilityBadge({ status }: { status: EligibilityStatus }) {
  const labelMap: Record<EligibilityStatus, { label: string; className: string }> = {
    eligible: {
      label: 'Eligible today',
      className: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    },
    missing: {
      label: 'Missing prerequisites',
      className: 'bg-amber-100 text-amber-900 border-amber-200',
    },
    conflict: {
      label: 'Blocked by conflict',
      className: 'bg-red-100 text-red-900 border-red-200',
    },
    unknown: {
      label: 'Unknown privilege',
      className: 'bg-slate-100 text-slate-900 border-slate-200',
    },
  };

  const current = labelMap[status];
  return <div className={`rounded-md border px-3 py-2 text-sm font-semibold ${current.className}`}>{current.label}</div>;
}

function StatusPill({ status }: { status: RequirementStatus }) {
  const map: Record<RequirementStatus, string> = {
    complete: 'bg-emerald-100 text-emerald-800',
    expiring: 'bg-amber-100 text-amber-900',
    inProgress: 'bg-blue-100 text-blue-900',
    missing: 'bg-red-100 text-red-900',
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${map[status]}`}>{status}</span>;
}

function ProfileRow({
  label,
  items,
  badge,
}: {
  label: string;
  items: string[];
  badge: 'success' | 'warning' | 'info' | 'destructive';
}) {
  const colorMap = {
    success: 'bg-emerald-100 text-emerald-900',
    warning: 'bg-amber-100 text-amber-900',
    info: 'bg-blue-100 text-blue-900',
    destructive: 'bg-red-100 text-red-900',
  } as const;

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">None recorded.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((code) => (
            <span key={code} className={`rounded-full px-2.5 py-1 text-xs font-medium ${colorMap[badge]}`}>
              {code}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}


