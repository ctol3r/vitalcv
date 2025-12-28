import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, ShieldCheck, TimerReset } from 'lucide-react';
import Link from 'next/link';

const steps = [
  {
    title: 'Clinician credential issued once',
    detail:
      'Issuer mints a single verifiable credential for the clinician with audit-proof hashing. No rework per system.',
  },
  {
    title: 'Verified instantly by hospital',
    detail:
      'Hospital verifier checks the credential with nonce + audience binding. Latency is tracked for every presentation.',
  },
  {
    title: 'Completion % shown per role',
    detail:
      'Matching events log completion percentage so pilots can see how much of the checklist is auto-completed.',
  },
  {
    title: 'Audit proof available',
    detail:
      'Every issuance, verification, revocation, and match writes to the append-only audit log with Merkle roots.',
  },
  {
    title: 'Time saved vs traditional process',
    detail:
      'We benchmark speed and completeness without making unproven claims. Numbers come from real metric events.',
  },
];

export default function PilotWalkthroughPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-emerald-50">
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-emerald-700">Pilot Story Mode</p>
          <h1 className="text-4xl font-bold text-slate-900">Pilot walkthrough</h1>
          <p className="text-slate-600 max-w-3xl">
            Use this flow to narrate how VitalCV behaves in a health system pilot. Pair it with
            <Link href="/metrics" className="text-emerald-700 font-medium">
              {' '}
              live metrics
            </Link>{' '}
            and the pilot banner to keep demos safe and clear.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {steps.map((step, idx) => (
            <Card key={step.title} className="border-emerald-100 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  {idx + 1}. {step.title}
                </CardTitle>
                <CardDescription>{step.detail}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Card className="border-blue-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              Demo safety
            </CardTitle>
            <CardDescription>
              Turn on pilot mode via <code>?pilot=true</code> or{' '}
              <code>NEXT_PUBLIC_PILOT_MODE=true</code>. You&apos;ll see the pilot banner and
              relabeled actors (Pilot Health System, Pilot Clinician).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-6 text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <TimerReset className="h-4 w-4 text-blue-600" />
              Track time-to-verify and completion in <Link href="/metrics">/metrics</Link>.
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Audit events stream to <Link href="/status">/status</Link>.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
