'use client';

import { useMemo } from 'react';
import { Activity, ClipboardList, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ReadinessIndicator } from '@/components/mobility/ReadinessIndicator';

interface OnboardingRequest {
  id: string;
  clinician: string;
  targetOrg: string;
  readinessPercent: number;
  autoVerified: string[];
  pending: string[];
  owner: string;
  priority: 'routine' | 'priority';
  createdAt: string;
}

export default function OrgOnboardingViewer() {
  const requests = useMemo<OnboardingRequest[]>(
    () => [
      {
        id: 'REQ-78011',
        clinician: 'Dr. Sunita Peña',
        targetOrg: 'Metro One Health',
        readinessPercent: 95,
        autoVerified: ['NPI + PECOS match', 'WA & OR state licenses', 'Board cert: Cardiology', 'DEA active'],
        pending: ['Schedule short orientation slot'],
        owner: 'Mobility bot',
        priority: 'routine',
        createdAt: 'Nov 07, 2025',
      },
      {
        id: 'REQ-78044',
        clinician: 'Dr. Tomas Becker',
        targetOrg: 'Beacon Trauma',
        readinessPercent: 72,
        autoVerified: ['NPI identity', 'Malpractice face sheet', 'Trauma call references'],
        pending: ['Upload ATLS CME letter', 'Agent verifying ACLS (auto)'],
        owner: 'Claire T.',
        priority: 'priority',
        createdAt: 'Nov 06, 2025',
      },
      {
        id: 'REQ-78060',
        clinician: 'PA Riley Shah',
        targetOrg: 'Orbit Care Network',
        readinessPercent: 41,
        autoVerified: ['NPI/API identity', 'I-9 stored'],
        pending: ['New Mexico license file', 'HR background check packet', 'Privileges peer references'],
        owner: 'Mobility bot',
        priority: 'routine',
        createdAt: 'Nov 05, 2025',
      },
    ],
    [],
  );

  const highestPriority = requests.filter((req) => req.priority === 'priority');

  return (
    <div className="container mx-auto space-y-6 p-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          Demo &raquo; Org &raquo; Mobility onboarding
        </div>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Incoming clinicians</h1>
            <p className="text-muted-foreground max-w-3xl">
              Each onboarding request includes automated readiness scoring plus a breakdown of auto-verified data versus
              manual blockers.
            </p>
          </div>
          <Button variant="outline" size="sm">
            Export CSV
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Card role="status" aria-live="polite">
          <CardHeader>
            <CardDescription>Total requests</CardDescription>
            <CardTitle className="text-4xl font-semibold">{requests.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Mobility queue in the past 7 days.</p>
          </CardContent>
        </Card>
        <Card role="status" aria-live="polite">
          <CardHeader>
            <CardDescription>Priority</CardDescription>
            <CardTitle className="text-4xl font-semibold">{highestPriority.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Requires human review before agent release.</p>
          </CardContent>
        </Card>
        <Card role="status" aria-live="polite">
          <CardHeader>
            <CardDescription>Automation coverage</CardDescription>
            <CardTitle className="text-4xl font-semibold">78%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Average of auto-verified checklist items.</p>
          </CardContent>
        </Card>
      </section>

      <div className="space-y-4">
        {requests.map((request) => {
          const readinessState = request.readinessPercent >= 90 ? 'ready' : request.readinessPercent >= 60 ? 'partial' : 'blocked';

          return (
            <Card key={request.id} aria-live="polite">
              <CardHeader>
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="text-xl">{request.clinician}</CardTitle>
                    <CardDescription>
                      Target org: {request.targetOrg} • Added {request.createdAt}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <ReadinessIndicator
                      state={readinessState}
                      label={`${request.readinessPercent}% ready`}
                      blockedReasons={request.pending}
                      ariaDescription={`${request.id} readiness ${request.readinessPercent}%`}
                    />
                    <Badge variant={request.priority === 'priority' ? 'destructive' : 'secondary'}>{request.priority}</Badge>
                    <Badge variant="outline">{request.id}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
                <section>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Auto-verified</h2>
                  <div className="mt-3 grid gap-3">
                    {request.autoVerified.map((item) => (
                      <div key={item} className="flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
                        <Activity className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section aria-live="polite">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                    Pending manual
                    {request.pending.length > 0 ? (
                      <Badge variant="outline">{request.pending.length}</Badge>
                    ) : (
                      <Badge variant="default">Cleared</Badge>
                    )}
                  </h2>
                  {request.pending.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">All prerequisites are satisfied.</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {request.pending.map((item) => (
                        <div key={item} className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                          <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-600" aria-hidden="true" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <div className="lg:col-span-2 flex flex-wrap items-center justify-between gap-4 border-t pt-4 text-sm">
                  <div className="space-y-1">
                    <p className="font-medium">Owner</p>
                    <p className="text-muted-foreground">{request.owner}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm">Release to agent</Button>
                    <Button size="sm" variant="outline">
                      View audit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}


