'use client';

import { DemoHeader } from '@/apps/web/src/components/layout/DemoHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, Info, Shield } from 'lucide-react';

const CHECKS_IN_PROGRESS = [
  {
    id: 'licenses',
    title: 'Licenses & sanctions',
    summary: 'The agent is checking state boards, NPDB, and OIG lists to confirm everything is still active.',
    eta: '≈2 minutes',
    evidence: 'State board APIs + NPDB cache',
    status: 'clean',
    steps: [
      'Confirms the expiration date of each state license (WA, OR, CA).',
      'Looks for disciplinary notes or sanctions added since the last review.',
      'Flags anything that needs human review before privileges renew.',
    ],
  },
  {
    id: 'pecos',
    title: 'PECOS & payer enrollment',
    summary: 'Compares PECOS enrollment data against our payer roster to make sure nothing drifted.',
    eta: '≈4 minutes',
    evidence: 'PECOS export + payer roster snapshot',
    status: 'watch',
    steps: [
      'Matches every PECOS enrollment to an active payer record.',
      'Highlights differences in practice addresses or specialties.',
      'Queues remediation if a payer needs new documentation.',
    ],
  },
  {
    id: 'training',
    title: 'DEA & training docs',
    summary: 'Ensures DEA registration and required training certificates are still current.',
    eta: '≈1 minute',
    evidence: 'DEA registry + LMS receipts',
    status: 'clean',
    steps: [
      'Checks DEA expiration dates and schedule coverage.',
      'Confirms annual training certificates are uploaded (HIPAA, opioid, safety).',
      'Links any missing files to the remediation queue.',
    ],
  },
];

const NEXT_STEPS = [
  'If anything is flagged, you will get a notification with the exact document or form to update.',
  'You can download the evidence pack any time—no waiting for email attachments.',
  'If everything stays green, privileges continue without extra paperwork.',
];

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  clean: { label: 'All clear', className: 'border-emerald-400 text-emerald-600' },
  watch: { label: 'Watching', className: 'border-amber-400 text-amber-600' },
  action: { label: 'Needs action', className: 'border-rose-400 text-rose-600' },
};

export default function ClinicianAgentPage() {
  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-8">
      <DemoHeader
        title="What the agent is checking for you"
        description="Plain-language status so you always know why the credentialing agent is working and what happens next."
      />

      <Alert variant="default" role="status" aria-live="polite">
        <Info className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>Nothing to fix right now</AlertTitle>
        <AlertDescription>
          All required checks are running in the background. If the agent notices something you must review, you'll get a clear message with the next step.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" aria-hidden="true" />
            What is being checked?
          </CardTitle>
          <CardDescription>Each item expands to show the exact steps the agent is taking.</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full" defaultValue={CHECKS_IN_PROGRESS.map((item) => item.id)}>
            {CHECKS_IN_PROGRESS.map((check) => (
              <AccordionItem key={check.id} value={check.id}>
                <AccordionTrigger className="text-left">
                  <div className="flex flex-col gap-1 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{check.title}</span>
                      <Badge variant="outline" className={`text-xs ${STATUS_BADGES[check.status].className}`}>
                        {STATUS_BADGES[check.status].label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{check.eta}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{check.summary}</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium">How it works</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {check.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium">Evidence</p>
                    <p className="text-muted-foreground">{check.evidence}</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What happens next?</CardTitle>
          <CardDescription>These are the only actions you'll ever see if something needs your attention.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {NEXT_STEPS.map((step, index) => (
              <li key={step} className="flex items-start gap-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
                <span>
                  <span className="font-semibold">Step {index + 1}:</span> {step}
                </span>
              </li>
            ))}
          </ol>
          <Separator className="my-4" />
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Download latest evidence</Button>
            <Button size="sm" variant="outline">
              Share with privileging office
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>If you need a person</CardTitle>
          <CardDescription>We'll keep the wording plain and screen-reader friendly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Call or message the credentialing team any time. Tell them the agent flagged an item and they can open the same view you see now—no guessing.
          </p>
          <p>
            Prefer email? Hit reply on any Vital Credentialing alert. The subject already contains the tracking ID so support can respond quickly.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
