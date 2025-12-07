'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ArrowUpRight, BarChart3, Clock4, Flame, ShieldCheck, UsersRound } from 'lucide-react';

interface SupplyDemandSlice {
  department: string;
  role: string;
  supply: number;
  demand: number;
  delta: number;
  coverage: string;
}

interface ReadinessCell {
  shift: string;
  role: string;
  readiness: number;
  risk: 'low' | 'medium' | 'high';
  blockers: string[];
}

interface Recommendation {
  shift: string;
  role: string;
  coverage: string;
  candidates: Array<{
    name: string;
    org: string;
    score: number;
    risk: 'low' | 'medium';
    notes: string;
    badges: string[];
  }>;
}

const supplyDemandSeries: SupplyDemandSlice[] = [
  { department: 'ICU', role: 'Night intensivist', supply: 18, demand: 22, delta: -4, coverage: '82%' },
  { department: 'ED', role: 'Fast-track APP', supply: 26, demand: 24, delta: 2, coverage: '108%' },
  { department: 'Cath Lab', role: 'Interventional cardiologist', supply: 9, demand: 12, delta: -3, coverage: '75%' },
  { department: 'Telehealth', role: 'Behavioral health', supply: 32, demand: 30, delta: 2, coverage: '106%' },
];

const readinessHeatmap: ReadinessCell[] = [
  { shift: 'ICU Nights', role: 'MD', readiness: 0.92, risk: 'low', blockers: [] },
  { shift: 'ICU Days', role: 'APP', readiness: 0.78, risk: 'medium', blockers: ['Epic Beacon training overdue'] },
  { shift: 'Cath Lab Call', role: 'MD', readiness: 0.66, risk: 'medium', blockers: ['Payer panel pending'] },
  { shift: 'Med/Surg Days', role: 'RN', readiness: 0.88, risk: 'low', blockers: [] },
  { shift: 'Behavioral Tele', role: 'LCSW', readiness: 0.55, risk: 'high', blockers: ['Quality remediation in progress', 'Mobility hold'] },
];

const recommendations: Recommendation[] = [
  {
    shift: 'ICU Nights — Week 48',
    role: 'Board-certified Intensivist',
    coverage: 'Needs 2 FTE',
    candidates: [
      {
        name: 'Dr. Maya Chen',
        org: 'Northstar Health',
        score: 0.93,
        risk: 'low',
        notes: 'IMLC, Epic+Cerner ready, payer parity on 4/5 mix',
        badges: ['Compact ready', 'Mobility: instant', 'Epic Beacon'],
      },
      {
        name: 'Dr. Adrian Wells',
        org: 'Coastal Care',
        score: 0.88,
        risk: 'low',
        notes: 'Privileges mirrored, risk score 0.28, cross-org mobility ticket open',
        badges: ['Quality gold', 'Payer ready'],
      },
      {
        name: 'Dr. Kavita Rao',
        org: 'Anchor Health',
        score: 0.81,
        risk: 'medium',
        notes: 'Needs Epic refresher, drift sweep scheduled tonight',
        badges: ['Compact', 'EHR refresher due'],
      },
    ],
  },
  {
    shift: 'Cath Lab Call — Fri/Sat',
    role: 'Interventional Cardiology',
    coverage: 'Needs 1 FTE',
    candidates: [
      {
        name: 'Dr. Jonah Becker',
        org: 'Metro Vascular',
        score: 0.86,
        risk: 'low',
        notes: 'Privileges aligned, payer bundle 3/3, ready for Siemens ARTIS',
        badges: ['Privileges ready', 'Siemens'],
      },
      {
        name: 'Dr. Reina Flores',
        org: 'Crestline',
        score: 0.79,
        risk: 'medium',
        notes: 'Needs payer amendment for Payer-B, risk score 0.38 (under tolerance)',
        badges: ['Payer pending'],
      },
    ],
  },
];

const readinessColor = (value: number) => {
  if (value >= 0.85) return 'bg-emerald-100 border-emerald-200 text-emerald-900';
  if (value >= 0.7) return 'bg-amber-100 border-amber-200 text-amber-900';
  return 'bg-rose-100 border-rose-200 text-rose-900';
};

const riskBadgeVariant: Record<ReadinessCell['risk'] | Recommendation['candidates'][number]['risk'], string> = {
  low: 'bg-emerald-100 text-emerald-900 border border-emerald-200',
  medium: 'bg-amber-100 text-amber-900 border border-amber-200',
  high: 'bg-rose-100 text-rose-900 border border-rose-200',
};

export default function OrgWorkforceDashboardPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Demo » Org » Workforce</p>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <UsersRound className="h-6 w-6" /> Workforce coverage cockpit
        </h1>
        <p className="text-muted-foreground max-w-3xl">
          Monitor supply vs demand, readiness, and mobility-qualified recommendations in a single pane. Data is
          hydrated from privileges, compacts, payer enrollment, EHR training, and risk engines.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Supply vs demand</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">91%</div>
            <p className="text-xs text-muted-foreground">Weighted coverage over next 14 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High-risk shifts</CardTitle>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">Require action before week 48</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Instant mobility</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">14</div>
            <p className="text-xs text-muted-foreground">Clinicians cleared for cross-org redeployment</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Supply vs demand detail</CardTitle>
          <CardDescription>Coverage computed from privilege readiness, compacts, and availability.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            {supplyDemandSeries.map((slice) => {
              const percentage = Math.min(120, Math.round((slice.supply / slice.demand) * 100));
              const isGap = slice.delta < 0;
              return (
                <div key={`${slice.department}-${slice.role}`} className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <div>
                      <span className="text-foreground">{slice.department}</span>
                      <span className="text-muted-foreground"> • {slice.role}</span>
                    </div>
                    <div className={cn('flex items-center gap-2', isGap ? 'text-rose-600' : 'text-emerald-600')}>
                      {slice.supply}/{slice.demand}
                      <span className="text-xs font-semibold">{slice.coverage}</span>
                    </div>
                  </div>
                  <div className="relative h-3 rounded-full bg-muted">
                    <div
                      className={cn('absolute left-0 top-0 h-full rounded-full', isGap ? 'bg-rose-500' : 'bg-emerald-500')}
                      style={{ width: `${percentage}%` }}
                    />
                    <div className="absolute inset-y-0 right-[20%] w-px bg-border" aria-hidden />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isGap ? 'Gap flagged. Negative constraint check running.' : 'Surplus available for redeployment.'}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Readiness heatmap</CardTitle>
          <CardDescription>Privileges + payer + EHR readiness roll-up by shift and role.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {readinessHeatmap.map((cell) => (
              <div
                key={`${cell.shift}-${cell.role}`}
                className={cn('rounded-lg border px-4 py-3 shadow-sm transition hover:shadow-md', readinessColor(cell.readiness))}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{cell.shift}</p>
                    <p className="text-xs text-muted-foreground">{cell.role}</p>
                  </div>
                  <Badge variant="outline" className={cn('text-xs', riskBadgeVariant[cell.risk])}>
                    {Math.round(cell.readiness * 100)}%
                  </Badge>
                </div>
                {cell.blockers.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {cell.blockers.map((blocker) => (
                      <li key={blocker} className="flex items-start gap-1">
                        <Clock4 className="mt-0.5 h-3 w-3" /> {blocker}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Fully cleared</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recommended candidates per shift</CardTitle>
          <CardDescription>
            Ranked via WorkforceMatchingEngine with mobility-aware overlay. Score combines privileges, payer parity,
            EHR readiness, risk, and availability.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {recommendations.map((row) => (
            <div key={row.shift} className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{row.shift}</p>
                  <h3 className="text-xl font-semibold">{row.role}</h3>
                </div>
                <Badge variant="secondary">{row.coverage}</Badge>
                <Button size="sm" variant="outline">
                  View shift packet <ArrowUpRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clinician</TableHead>
                    <TableHead>Origin org</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Badges</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {row.candidates.map((candidate) => (
                    <TableRow key={candidate.name}>
                      <TableCell className="font-medium flex items-center gap-2">
                        {candidate.name}
                        <Badge className={cn('text-xs', riskBadgeVariant[candidate.risk])}>
                          {candidate.risk === 'low' ? 'Risk OK' : 'Monitor'}
                        </Badge>
                      </TableCell>
                      <TableCell>{candidate.org}</TableCell>
                      <TableCell>{Math.round(candidate.score * 100)}%</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{candidate.notes}</TableCell>
                      <TableCell className="flex flex-wrap justify-end gap-2">
                        {candidate.badges.map((badge) => (
                          <Badge key={badge} variant="outline" className="text-xs">
                            {badge}
                          </Badge>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
