'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, ArrowRight, Clock, ShieldCheck, BadgeCheck, Zap, Link } from 'lucide-react';

type StageStatus = 'completed' | 'current' | 'upcoming';

interface TimelineStage {
  id: string;
  title: string;
  description: string;
  date: string;
  status: StageStatus;
  icon: JSX.Element;
}

export default function RecruiterTimelinePage() {
  const params = useParams<{ id: string }>();

  const stages = useMemo<TimelineStage[]>(() => {
    return [
      {
        id: 'submitted',
        title: 'Application submitted',
        description: 'Candidate dossier synced to recruiter portal.',
        date: '2025-11-02 09:14 ET',
        status: 'completed',
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      },
      {
        id: 'psv',
        title: 'PSV done',
        description: 'Primary source verification run with automated collectors.',
        date: '2025-11-03 07:12 ET',
        status: 'completed',
        icon: <ShieldCheck className="h-4 w-4 text-emerald-500" />,
      },
      {
        id: 'chain',
        title: 'Chain anchor',
        description: 'Verification packet anchored on Vital chain (pilot-l2).',
        date: '2025-11-03 07:15 ET',
        status: 'completed',
        icon: <Link className="h-4 w-4 text-sky-500" />,
      },
      {
        id: 'proof',
        title: 'Proof verified',
        description: 'OIDC4VP presentation validated by recruiter verifier.',
        date: '2025-11-03 07:16 ET',
        status: 'current',
        icon: <BadgeCheck className="h-4 w-4 text-blue-500" />,
      },
      {
        id: 'readiness',
        title: 'Readiness gained',
        description: 'Clinician readiness threshold unlocked for auto-matching.',
        date: 'Pending',
        status: 'upcoming',
        icon: <Zap className="h-4 w-4 text-amber-500" />,
      },
    ];
  }, [params.id]);

  return (
    <div className="container mx-auto max-w-4xl px-6 py-10 space-y-8">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Recruiter • Applicant timeline</p>
        <h1 className="text-3xl font-semibold tracking-tight">Readiness timeline</h1>
        <p className="text-muted-foreground">
          Sequence of verification and readiness milestones for candidate #{params.id}.
        </p>
      </header>

      <Alert>
        <Clock className="h-4 w-4" />
        <AlertTitle>Real-time updates</AlertTitle>
        <AlertDescription>
          Timeline refreshes every 3 minutes when recruiter presence is active.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Milestone tracker</CardTitle>
          <CardDescription>Submitted → PSV → Chain anchor → Proof → Readiness.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <div className="absolute left-3 top-3 bottom-3 w-px bg-muted" />
            <div className="space-y-6">
              {stages.map((stage, index) => (
                <div key={stage.id} className="relative flex gap-4 pl-8">
                  <div className="absolute left-0 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border bg-background">
                    {stage.icon}
                  </div>
                  <div className="flex-1 rounded-lg border p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium">{stage.title}</p>
                        <p className="text-sm text-muted-foreground">{stage.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={stage.status === 'completed' ? 'default' : stage.status === 'current' ? 'secondary' : 'outline'}>
                          {stage.status === 'completed' && 'Completed'}
                          {stage.status === 'current' && 'In progress'}
                          {stage.status === 'upcoming' && 'Waiting'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{stage.date}</span>
                      </div>
                    </div>
                    {index < stages.length - 1 && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <ArrowRight className="h-3 w-3" />
                        Next: {stages[index + 1].title}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Readiness summary</CardTitle>
          <CardDescription>Auto-generated signal pack.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <SummaryTile title="Submitted" value="2025-11-02" subtext="All dossier docs" />
          <SummaryTile title="PSV" value="Complete" subtext="All sources matched" />
          <SummaryTile title="Readiness" value="Pending" subtext="Awaiting readiness gain" />
        </CardContent>
      </Card>

      <Separator />
    </div>
  );
}

function SummaryTile({ title, value, subtext }: { title: string; value: string; subtext: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{subtext}</p>
    </div>
  );
}

