'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ArrowRight, Building2, Globe2, Sparkles } from 'lucide-react';

type MobilityStatus = 'instantly_onboardable' | 'portable' | 'blocked';

type Opportunity = {
  id: string;
  org: string;
  department: string;
  role: string;
  shift: string;
  readiness: number;
  demand: string;
  mobility: MobilityStatus;
  reasons: string[];
  badges: string[];
};

const opportunities: Opportunity[] = [
  {
    id: 'opp-icu-nights',
    org: 'Vita Health',
    department: 'ICU',
    role: 'Night Intensivist',
    shift: 'Thu-Sun • 12h',
    readiness: 0.94,
    demand: '4 shifts / week',
    mobility: 'instantly_onboardable',
    reasons: ['Privileges mirrored', 'Epic Beacon trained', 'Risk score 0.22 < 0.35 threshold'],
    badges: ['Compact ready', 'Mobility instant', 'Payer parity'],
  },
  {
    id: 'opp-cath-call',
    org: 'Northstar',
    department: 'Cath Lab',
    role: 'Interventional Cardiologist',
    shift: 'Fri-Sat call',
    readiness: 0.82,
    demand: 'Call pool relief',
    mobility: 'portable',
    reasons: ['Needs payer B rider', 'EHR credentialing complete'],
    badges: ['Mobility portable', 'Payer amendment'],
  },
  {
    id: 'opp-tele-psych',
    org: 'Anchor Behavioral',
    department: 'Telehealth Behavioral',
    role: 'LCSW',
    shift: 'Flexible',
    readiness: 0.76,
    demand: '3 sessions / day',
    mobility: 'instantly_onboardable',
    reasons: ['Mobility engine cleared', 'Compact privileges auto-approved'],
    badges: ['Telehealth', 'NCQA ready'],
  },
  {
    id: 'opp-med-surg',
    org: 'CoreCare',
    department: 'Med/Surg',
    role: 'Charge RN',
    shift: 'Days',
    readiness: 0.58,
    demand: 'Float coverage',
    mobility: 'blocked',
    reasons: ['Quality remediation outstanding', 'Drift score HIGH'],
    badges: ['Mobility hold'],
  },
];

const filters = [
  { label: 'All opportunities', value: 'all' },
  { label: 'Instant mobility', value: 'instant' },
  { label: 'My org only', value: 'org' },
] as const;

type FilterValue = (typeof filters)[number]['value'];

const mobilityLabel: Record<MobilityStatus, string> = {
  instantly_onboardable: 'Instant mobility',
  portable: 'Portable — needs prep',
  blocked: 'Blocked',
};

const mobilityTone: Record<MobilityStatus, string> = {
  instantly_onboardable: 'bg-emerald-100 text-emerald-900 border border-emerald-200',
  portable: 'bg-amber-100 text-amber-900 border border-amber-200',
  blocked: 'bg-rose-100 text-rose-900 border border-rose-200',
};

export default function ClinicianOpportunitiesPage() {
  const [filter, setFilter] = useState<FilterValue>('all');
  const preferredOrg = 'Northstar';

  const visible = useMemo(() => {
    if (filter === 'instant') {
      return opportunities.filter((opp) => opp.mobility === 'instantly_onboardable');
    }
    if (filter === 'org') {
      return opportunities.filter((opp) => opp.org === preferredOrg);
    }
    return opportunities;
  }, [filter, preferredOrg]);

  const instantCount = opportunities.filter((opp) => opp.mobility === 'instantly_onboardable').length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Demo » Clinician » Workforce opportunities</p>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Globe2 className="h-6 w-6" /> Mobility-aware panel
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          See departments and roles you are eligible for across every connected org. Mobility signals show whether the
          WorkforceMatchingEngine can instantly redeploy you or if onboarding steps remain.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Open opportunities</CardTitle>
            <CardDescription>Filtered based on privileges + payer + EHR readiness.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{opportunities.length}</div>
            <p className="text-xs text-muted-foreground">Updated every 15 minutes.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Instant mobility ready</CardTitle>
            <CardDescription>Cleared for redeployment now.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{instantCount}</div>
            <p className="text-xs text-muted-foreground">via MobilityIntegration.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Home org matches</CardTitle>
            <CardDescription>{preferredOrg}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {opportunities.filter((opp) => opp.org === preferredOrg).length}
            </div>
            <p className="text-xs text-muted-foreground">Eligible without mobility workflow.</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        {filters.map((item) => (
          <Button
            key={item.value}
            size="sm"
            variant={filter === item.value ? 'default' : 'outline'}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eligible departments & roles</CardTitle>
          <CardDescription>
            Pulls from privileges, compacts, payer coverage, EHR readiness, and the negative constraint engine.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Org</TableHead>
                <TableHead>Department / Role</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Readiness</TableHead>
                <TableHead>Mobility</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((opp) => (
                <TableRow key={opp.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {opp.org}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{opp.department}</div>
                    <div className="text-sm text-muted-foreground">{opp.role}</div>
                  </TableCell>
                  <TableCell>{opp.shift}</TableCell>
                  <TableCell>
                    <div className="text-sm font-semibold">{Math.round(opp.readiness * 100)}%</div>
                    <p className="text-xs text-muted-foreground">{opp.demand}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-xs', mobilityTone[opp.mobility])}>
                      {mobilityLabel[opp.mobility]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="secondary">
                      View packet <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {visible.map((opp) => (
          <Card key={`${opp.id}-details`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> {opp.department}
              </CardTitle>
              <CardDescription>{opp.role}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Mobility readiness</p>
                <Badge variant="outline" className={cn('text-xs', mobilityTone[opp.mobility])}>
                  {mobilityLabel[opp.mobility]}
                </Badge>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${opp.readiness * 100}%` }} />
              </div>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                {opp.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                {opp.badges.map((badge) => (
                  <Badge key={badge} variant="secondary">
                    {badge}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
