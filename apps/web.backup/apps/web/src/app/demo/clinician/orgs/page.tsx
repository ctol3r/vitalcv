'use client';

import { useMemo } from 'react';
import { Building2, ClipboardCheck, Inbox, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ReadinessIndicator } from '@/components/mobility/ReadinessIndicator';

interface ActiveOrg {
  id: string;
  name: string;
  role: string;
  location: string;
  serviceLine: string;
  since: string;
  ehr: string;
  readiness: {
    state: 'ready' | 'partial' | 'blocked';
    blockers?: string[];
  };
}

interface PendingInvite {
  id: string;
  org: string;
  role: string;
  expiresIn: string;
  requestedBy: string;
  blockers: string[];
}

interface ReadyToOnboardItem {
  id: string;
  org: string;
  onboardingTrack: string;
  readinessPercent: number;
  blockers: string[];
}

const FALLBACK_CLINICIAN = 'Dr. A. Reid';

export default function ClinicianOrgsDashboard() {
  const activeOrgs = useMemo<ActiveOrg[]>(
    () => [
      {
        id: 'north-star',
        name: 'North Star Health',
        role: 'Full medical staff',
        location: 'Seattle, WA',
        serviceLine: 'Cardiology & EP lab',
        since: 'Feb 2023',
        ehr: 'Epic Nebula (synced 2h ago)',
        readiness: { state: 'ready' },
      },
      {
        id: 'aurora',
        name: 'Aurora Regional',
        role: 'Telehospitalist affiliate',
        location: 'Spokane, WA',
        serviceLine: 'Hospital medicine',
        since: 'Aug 2024',
        ehr: 'Cerner Rev-12 (synced yesterday)',
        readiness: {
          state: 'partial',
          blockers: ['DEA re-verification due 11/30', 'Peer references signed PDF'],
        },
      },
      {
        id: 'cascade',
        name: 'Cascade Children’s',
        role: 'Locum pediatrics',
        location: 'Portland, OR',
        serviceLine: 'Pediatric EM',
        since: 'Pending Go-Live',
        ehr: 'Epic Hyperdrive (not connected)',
        readiness: {
          state: 'blocked',
          blockers: ['State license endorsement awaiting notarized affidavit'],
        },
      },
    ],
    [],
  );

  const pendingInvites = useMemo<PendingInvite[]>(
    () => [
      {
        id: 'INV-8842',
        org: 'Sound Valley Medical',
        role: 'Consulting cardiologist',
        expiresIn: '5 days',
        requestedBy: 'Megan Ortiz',
        blockers: ['Accept digital bylaws packet'],
      },
      {
        id: 'INV-8895',
        org: 'Orbit Care Network',
        role: 'Remote coverage',
        expiresIn: '12 days',
        requestedBy: 'Credentialing bot (auto)',
        blockers: ['Confirm call coverage availability', 'Upload malpractice face sheet'],
      },
    ],
    [],
  );

  const readyToOnboard = useMemo<ReadyToOnboardItem[]>(
    () => [
      {
        id: 'RTR-001',
        org: 'Metro One Health',
        onboardingTrack: 'Fast-track ED privileges',
        readinessPercent: 92,
        blockers: ['Awaiting HR orientation slot'],
      },
      {
        id: 'RTR-002',
        org: 'Beacon Trauma',
        onboardingTrack: 'Trauma coverage swap',
        readinessPercent: 68,
        blockers: ['Upload ATLS CME letter', 'Sign trauma call addendum'],
      },
    ],
    [],
  );

  const readyCount = readyToOnboard.filter((item) => item.readinessPercent >= 90).length;

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" aria-hidden="true" />
          Demo &raquo; Clinician &raquo; My Organizations
        </div>
        <div className="flex flex-col gap-1 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Organizations</h1>
            <p className="text-muted-foreground max-w-3xl">
              Overview of your current medical staff relationships, pending invitations, and onboarding tracks. Designed
              to be screen-reader friendly with live updates.
            </p>
          </div>
          <Badge variant="outline" className="w-fit">
            Viewing as {FALLBACK_CLINICIAN}
          </Badge>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card role="status" aria-live="polite">
          <CardHeader className="space-y-1">
            <CardDescription>Active organizations</CardDescription>
            <CardTitle className="text-4xl font-bold">{activeOrgs.filter((org) => org.readiness.state !== 'blocked').length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {activeOrgs.length} total relationships ({activeOrgs.filter((org) => org.readiness.state === 'ready').length} ready).
            </p>
          </CardContent>
        </Card>

        <Card role="status" aria-live="polite">
          <CardHeader className="space-y-1">
            <CardDescription>Pending invites</CardDescription>
            <CardTitle className="text-4xl font-bold">{pendingInvites.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {pendingInvites.map((invite) => invite.id).join(', ')}
            </p>
          </CardContent>
        </Card>

        <Card role="status" aria-live="polite">
          <CardHeader className="space-y-1">
            <CardDescription>Ready to onboard</CardDescription>
            <CardTitle className="text-4xl font-bold">{readyCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Tracks at or above 90% readiness.</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            Active relationships
          </CardTitle>
          <CardDescription>Privileges and connection readiness, including EHR sync status.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Organization</TableHead>
                <TableHead scope="col">Role</TableHead>
                <TableHead scope="col">Location</TableHead>
                <TableHead scope="col">Service line</TableHead>
                <TableHead scope="col">Since</TableHead>
                <TableHead scope="col">Instant readiness</TableHead>
                <TableHead scope="col">Connectivity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeOrgs.map((org) => (
                <TableRow key={org.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{org.name}</span>
                      <span className="text-xs text-muted-foreground">Org ID: {org.id}</span>
                    </div>
                  </TableCell>
                  <TableCell>{org.role}</TableCell>
                  <TableCell>{org.location}</TableCell>
                  <TableCell>{org.serviceLine}</TableCell>
                  <TableCell>{org.since}</TableCell>
                  <TableCell>
                    <ReadinessIndicator
                      state={org.readiness.state}
                      blockedReasons={org.readiness.blockers}
                      ariaDescription={`${org.name} readiness is ${org.readiness.state}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      <span>{org.ehr}</span>
                      <span className="text-xs text-muted-foreground">FHIR agent online</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card aria-live="polite">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Inbox className="h-5 w-5 text-sky-600" aria-hidden="true" />
              Pending invitations
            </CardTitle>
            <CardDescription>Review invite details and blockers before accepting.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{invite.org}</p>
                    <p className="text-sm text-muted-foreground">{invite.role}</p>
                  </div>
                  <Badge variant="outline">{invite.id}</Badge>
                </div>
                <dl className="mt-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Expires</dt>
                    <dd>{invite.expiresIn}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Requested by</dt>
                    <dd>{invite.requestedBy}</dd>
                  </div>
                </dl>
                <div className="mt-4">
                  <p className="text-sm font-medium">To finish</p>
                  <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground space-y-1">
                    {invite.blockers.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm">Accept</Button>
                  <Button size="sm" variant="outline">
                    Ask a question
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card aria-live="polite">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="h-5 w-5 text-violet-600" aria-hidden="true" />
              Ready-to-onboard tracks
            </CardTitle>
            <CardDescription>Tracks with automated readiness scoring.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {readyToOnboard.map((item) => (
              <div key={item.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{item.org}</p>
                    <p className="text-sm text-muted-foreground">{item.onboardingTrack}</p>
                  </div>
                  <Badge variant="outline">{item.readinessPercent}%</Badge>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${item.readinessPercent}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Auto-verified data + outstanding blockers listed below.
                  </span>
                </div>
                <ReadinessIndicator
                  state={item.readinessPercent >= 90 ? 'ready' : item.readinessPercent >= 60 ? 'partial' : 'blocked'}
                  blockedReasons={item.blockers}
                  ariaDescription={`${item.org} onboarding readiness ${item.readinessPercent}%`}
                />
                <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  {item.blockers.length === 0 ? <li>All prerequisites satisfied</li> : item.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                </ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm">Schedule go-live call</Button>
                  <Button size="sm" variant="outline">
                    Share status
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}


