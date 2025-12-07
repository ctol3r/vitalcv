'use client';

import { CheckCircle2, ClipboardCheck, CloudCog, RadioTower, ShieldCheck, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface PageProps {
  params: {
    requestId: string;
  };
}

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  status: 'complete' | 'in-progress';
  icon: typeof CheckCircle2;
  timestamp: string;
  detail: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'checklist',
    title: 'Checklist signed off',
    description: 'Mobility checklist reviewed and attested',
    status: 'complete',
    icon: ClipboardCheck,
    timestamp: '15:41 PT',
    detail: 'All readiness items met threshold > 90%, no manual blockers remaining.',
  },
  {
    id: 'agent',
    title: 'Agent trigger',
    description: 'Mobility agent invoked',
    status: 'complete',
    icon: CloudCog,
    timestamp: '15:42 PT',
    detail: 'Credentialing agent pushed payload (PrivilegeSet, License proof, DEA) to Org B automation topic.',
  },
  {
    id: 'ehr',
    title: 'EHR sync',
    description: 'FHIR+HL7 sync with Org B',
    status: 'complete',
    icon: RadioTower,
    timestamp: '15:43 PT',
    detail: 'User provisioned in Epic Nebula sandbox, downstream to production scheduled for midnight cutover.',
  },
  {
    id: 'activation',
    title: 'Org B activation',
    description: 'Clinician moved to Active state',
    status: 'complete',
    icon: ShieldCheck,
    timestamp: '15:44 PT',
    detail: 'Org B privileges granted: CARD-ED-01, CARD-EP-05, CARD-TELE-02.',
  },
  {
    id: 'audit',
    title: 'Audit + timeline',
    description: 'Audit log & timeline entries emitted',
    status: 'in-progress',
    icon: Sparkles,
    timestamp: 'pending',
    detail: 'Final timeline event awaiting Org B acknowledgement. Expected < 2 minutes.',
  },
];

export default function MobilityCompletionPage({ params }: PageProps) {
  const { requestId } = params;
  const inProgress = WORKFLOW_STEPS.find((step) => step.status === 'in-progress');

  return (
    <div className="container mx-auto space-y-6 p-6">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Demo &raquo; Org &raquo; Onboarding &raquo; Complete</p>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mobility completion</h1>
            <p className="text-muted-foreground max-w-3xl">
              Checklist execution, agent orchestration, EHR sync, activation, and audit emission for request{' '}
              <span className="font-mono">{requestId}</span>.
            </p>
          </div>
          <Badge variant="outline">Request {requestId}</Badge>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Workflow status</CardTitle>
          <CardDescription>
            {inProgress ? `${inProgress.title} is in progress…` : 'All steps complete and recorded.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ol className="space-y-4" aria-live="polite">
            {WORKFLOW_STEPS.map((step) => {
              const Icon = step.icon;
              const isComplete = step.status === 'complete';
              return (
                <li key={step.id} className="flex gap-4 rounded-lg border p-4">
                  <div
                    className={`mt-1 flex h-10 w-10 items-center justify-center rounded-full border ${
                      isComplete ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
                    }`}
                  >
                    <Icon className={isComplete ? 'h-5 w-5 text-emerald-600' : 'h-5 w-5 text-amber-600'} aria-hidden="true" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{step.title}</p>
                      <Badge variant={isComplete ? 'default' : 'secondary'}>{isComplete ? 'Complete' : 'In progress'}</Badge>
                      <span className="text-xs text-muted-foreground">Timestamp: {step.timestamp}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                    <p className="text-sm">{step.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
            <div className="text-sm text-muted-foreground">
              Agent log stream is available for download. Ensure Org B timeline event posts before closing.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm">Download log bundle</Button>
              <Button size="sm" variant="outline">
                View timeline
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


