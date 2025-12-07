'use client';

import { useMemo } from 'react';
import { ArrowRightLeft, CheckCircle2, CircleAlert, Compare, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface PrivilegeDiff {
  code: string;
  description: string;
  orgAStatus: 'granted' | 'conditional' | 'missing';
  orgBRequirement: 'required' | 'optional';
  blockers: string[];
}

export default function CrossOrgPrivilegeComparison() {
  const diffs = useMemo<PrivilegeDiff[]>(
    () => [
      {
        code: 'CARD-ED-01',
        description: 'Emergency department cardiology consults',
        orgAStatus: 'granted',
        orgBRequirement: 'required',
        blockers: [],
      },
      {
        code: 'CARD-EP-05',
        description: 'Electrophysiology device implant',
        orgAStatus: 'conditional',
        orgBRequirement: 'required',
        blockers: ['Needs fluoroscopy competencies refresh', 'Annual sedation log missing'],
      },
      {
        code: 'CARD-CC-12',
        description: 'Critical care co-management',
        orgAStatus: 'missing',
        orgBRequirement: 'required',
        blockers: ['No matching privilege at Org A', 'Requires ABIM critical care track'],
      },
      {
        code: 'CARD-TELE-02',
        description: 'Telehealth chronic heart failure visits',
        orgAStatus: 'granted',
        orgBRequirement: 'optional',
        blockers: [],
      },
    ],
    [],
  );

  const fullyPortable = diffs.filter((diff) => diff.orgAStatus === 'granted' && diff.orgBRequirement === 'required').length;
  const mismatches = diffs.filter((diff) => diff.blockers.length > 0).length;

  return (
    <div className="container mx-auto space-y-6 p-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Compare className="h-4 w-4" aria-hidden="true" />
          Demo &raquo; Org &raquo; Privileges &raquo; Cross-org diff
        </div>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Org A vs Org B privileges</h1>
            <p className="text-muted-foreground max-w-3xl">
              Visual diff of PrivilegeSet definitions for a clinician. Highlights missing competencies and shows the
              delta between Org A (source) and Org B (target requirements).
            </p>
          </div>
          <Button variant="outline" size="sm">
            Download diff JSON
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Card role="status" aria-live="polite">
          <CardHeader>
            <CardDescription>Portable today</CardDescription>
            <CardTitle className="text-4xl font-semibold">{fullyPortable}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Privileges ready to map 1:1.</p>
          </CardContent>
        </Card>
        <Card role="status" aria-live="polite">
          <CardHeader>
            <CardDescription>Mismatches</CardDescription>
            <CardTitle className="text-4xl font-semibold text-amber-600">{mismatches}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Require additional proof or training.</p>
          </CardContent>
        </Card>
        <Card role="status" aria-live="polite">
          <CardHeader>
            <CardDescription>Optional extras</CardDescription>
            <CardTitle className="text-4xl font-semibold">
              {diffs.filter((diff) => diff.orgBRequirement === 'optional').length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Can be deferred until after onboarding.</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ArrowRightLeft className="h-5 w-5 text-sky-600" aria-hidden="true" />
            Privilege comparison
          </CardTitle>
          <CardDescription>Org A (current) vs Org B requirements.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Code</TableHead>
                <TableHead scope="col">Description</TableHead>
                <TableHead scope="col">Org A</TableHead>
                <TableHead scope="col">Org B requirement</TableHead>
                <TableHead scope="col">Mismatches</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diffs.map((diff) => (
                <TableRow key={diff.code}>
                  <TableCell className="font-medium">{diff.code}</TableCell>
                  <TableCell>{diff.description}</TableCell>
                  <TableCell>
                    <Badge variant={diff.orgAStatus === 'granted' ? 'default' : diff.orgAStatus === 'conditional' ? 'secondary' : 'destructive'}>
                      {diff.orgAStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={diff.orgBRequirement === 'required' ? 'default' : 'outline'}>{diff.orgBRequirement}</Badge>
                  </TableCell>
                  <TableCell>
                    {diff.blockers.length === 0 ? (
                      <div className="inline-flex items-center gap-1 text-emerald-600 text-sm">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        Matches
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {diff.blockers.map((blocker) => (
                          <div key={blocker} className="flex items-start gap-2 text-sm text-amber-700">
                            <CircleAlert className="mt-0.5 h-4 w-4" aria-hidden="true" />
                            <span>{blocker}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <XCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
            Highlighted gaps
          </CardTitle>
          <CardDescription>Auto-generated guidance to close the delta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {diffs
            .filter((diff) => diff.blockers.length > 0)
            .map((diff) => (
              <div key={diff.code} className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
                <p className="font-semibold">
                  {diff.code} • {diff.description}
                </p>
                <ul className="mt-2 list-disc pl-5 space-y-1 text-red-900">
                  {diff.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline">
                    Request evidence
                  </Button>
                  <Button size="sm" variant="ghost">
                    Attach training link
                  </Button>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}


