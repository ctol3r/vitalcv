import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, ShieldCheck, Stethoscope } from 'lucide-react';

export default function DemoPage() {
  return (
    <main className="bg-neutral-50 text-neutral-900">
      <section id="overview" className="border-b border-neutral-200/80 bg-white">
        <div className="container mx-auto px-6 py-12">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500">
              Demo walkthrough
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
              Single trust loop: clinician, issuer, employer
            </h1>
            <p className="mt-4 text-sm text-neutral-600 md:text-base">
              A calm, static walkthrough showing how authority is presented, updated, and accepted
              across the VitalCV network. Each screen is a truthful stub, not a live system.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 text-xs text-neutral-500">
            <Badge variant="outline" className="border-neutral-200/80 bg-white text-neutral-600">
              Stub &mdash; no live data
            </Badge>
            <Badge variant="outline" className="border-neutral-200/80 bg-white text-neutral-600">
              Static walkthrough
            </Badge>
            <Badge variant="outline" className="border-neutral-200/80 bg-white text-neutral-600">
              Three-step progression
            </Badge>
          </div>
          <nav className="mt-8 flex flex-wrap gap-3 text-sm" aria-label="Demo steps">
            <a
              href="#step-1"
              className="rounded-full border border-neutral-200/80 bg-white px-4 py-2 text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
            >
              1. Clinician presents authority
            </a>
            <a
              href="#step-2"
              className="rounded-full border border-neutral-200/80 bg-white px-4 py-2 text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
            >
              2. Issuer issues / updates authority
            </a>
            <a
              href="#step-3"
              className="rounded-full border border-neutral-200/80 bg-white px-4 py-2 text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
            >
              3. Employer accepts authority
            </a>
          </nav>
        </div>
      </section>

      <section className="container mx-auto px-6 py-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-8">
            <section id="step-1" className="scroll-mt-28">
              <Card className="border-neutral-200/80 bg-white">
                <CardHeader className="gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                        Step 1
                      </p>
                      <CardTitle className="mt-2 flex items-center gap-2 text-xl">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
                          <Stethoscope className="h-5 w-5" />
                        </span>
                        Clinician presents authority
                      </CardTitle>
                      <CardDescription className="mt-3 text-sm text-neutral-600">
                        A clinician shares a minimal disclosure packet that proves licensure status
                        without exposing extra personal data.
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="bg-neutral-100 text-neutral-700">
                      Stub &mdash; no live data
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-neutral-200/80 bg-neutral-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                      Presented authority packet
                    </p>
                    <dl className="mt-3 grid gap-3 text-sm text-neutral-700">
                      <div className="flex items-center justify-between gap-4">
                        <dt className="font-medium text-neutral-500">Credential</dt>
                        <dd>Medical License (sample)</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="font-medium text-neutral-500">Issuer</dt>
                        <dd>State Medical Board (stub)</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="font-medium text-neutral-500">Subject</dt>
                        <dd>Clinician DID (placeholder)</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="font-medium text-neutral-500">Disclosure scope</dt>
                        <dd>Name, status, expiry (sample)</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="grid gap-3 rounded-lg border border-neutral-200/80 bg-white p-4 text-sm text-neutral-600">
                    <p className="font-medium text-neutral-700">Controls shown</p>
                    <p>Selective disclosure to the employer, bound to the clinician wallet.</p>
                    <p>Signature chain verified locally against known issuer keys.</p>
                  </div>
                </CardContent>
                <CardFooter className="justify-between border-t border-neutral-200/80 pt-6">
                  <Button asChild variant="outline">
                    <a href="#overview">Back to overview</a>
                  </Button>
                  <Button asChild>
                    <a href="#step-2">Next: Issuer updates</a>
                  </Button>
                </CardFooter>
              </Card>
            </section>

            <section id="step-2" className="scroll-mt-28">
              <Card className="border-neutral-200/80 bg-white">
                <CardHeader className="gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                        Step 2
                      </p>
                      <CardTitle className="mt-2 flex items-center gap-2 text-xl">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
                          <ShieldCheck className="h-5 w-5" />
                        </span>
                        Issuer issues / updates authority
                      </CardTitle>
                      <CardDescription className="mt-3 text-sm text-neutral-600">
                        The issuing authority confirms the credential status and records an updated
                        authority entry with an audit trail.
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="bg-neutral-100 text-neutral-700">
                      Stub &mdash; no live data
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-neutral-200/80 bg-neutral-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                      Issuer update record
                    </p>
                    <dl className="mt-3 grid gap-3 text-sm text-neutral-700">
                      <div className="flex items-center justify-between gap-4">
                        <dt className="font-medium text-neutral-500">Action</dt>
                        <dd>Authority renewal (stub)</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="font-medium text-neutral-500">Validation</dt>
                        <dd>Registry check complete (sample)</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="font-medium text-neutral-500">Result</dt>
                        <dd>Credential updated + audit entry</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="font-medium text-neutral-500">Audit ref</dt>
                        <dd>VC-AUD-1182 (placeholder)</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="grid gap-3 rounded-lg border border-neutral-200/80 bg-white p-4 text-sm text-neutral-600">
                    <p className="font-medium text-neutral-700">Controls shown</p>
                    <p>Issuer signature binds the update to the existing credential chain.</p>
                    <p>Audit reference is recorded for compliance review.</p>
                  </div>
                </CardContent>
                <CardFooter className="justify-between border-t border-neutral-200/80 pt-6">
                  <Button asChild variant="outline">
                    <a href="#step-1">Back: Clinician packet</a>
                  </Button>
                  <Button asChild>
                    <a href="#step-3">Next: Employer accepts</a>
                  </Button>
                </CardFooter>
              </Card>
            </section>

            <section id="step-3" className="scroll-mt-28">
              <Card className="border-neutral-200/80 bg-white">
                <CardHeader className="gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                        Step 3
                      </p>
                      <CardTitle className="mt-2 flex items-center gap-2 text-xl">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
                          <Building2 className="h-5 w-5" />
                        </span>
                        Employer accepts authority
                      </CardTitle>
                      <CardDescription className="mt-3 text-sm text-neutral-600">
                        The employer verifies the authority chain and logs acceptance for onboarding
                        and compliance reporting.
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="bg-neutral-100 text-neutral-700">
                      Stub &mdash; no live data
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-neutral-200/80 bg-neutral-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                      Employer acceptance log
                    </p>
                    <dl className="mt-3 grid gap-3 text-sm text-neutral-700">
                      <div className="flex items-center justify-between gap-4">
                        <dt className="font-medium text-neutral-500">Decision</dt>
                        <dd>Authority accepted (sample)</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="font-medium text-neutral-500">Proof check</dt>
                        <dd>Signature + status valid</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="font-medium text-neutral-500">Usage</dt>
                        <dd>Hiring eligibility confirmed</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="font-medium text-neutral-500">Retention</dt>
                        <dd>Audit record retained (stub)</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="grid gap-3 rounded-lg border border-neutral-200/80 bg-white p-4 text-sm text-neutral-600">
                    <p className="font-medium text-neutral-700">Controls shown</p>
                    <p>Employer verifies issuer authority and clinician consent.</p>
                    <p>Acceptance logged for readiness and compliance teams.</p>
                  </div>
                </CardContent>
                <CardFooter className="justify-between border-t border-neutral-200/80 pt-6">
                  <Button asChild variant="outline">
                    <a href="#step-2">Back: Issuer update</a>
                  </Button>
                  <Button asChild>
                    <a href="#step-1">Restart loop</a>
                  </Button>
                </CardFooter>
              </Card>
            </section>
          </div>

          <aside className="h-fit rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm lg:sticky lg:top-24">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500">
              What this proves
            </p>
            <h2 className="mt-3 text-lg font-semibold text-neutral-900">
              Authority travels with verified context
            </h2>
            <p className="mt-3 text-sm text-neutral-600">
              This demo confirms a single trust loop with no live integrations: clinician evidence,
              issuer validation, and employer acceptance.
            </p>
            <div className="mt-5 space-y-4 text-sm text-neutral-600">
              <div className="rounded-lg border border-neutral-200/80 bg-neutral-50 p-4">
                <p className="font-medium text-neutral-700">Proof chain</p>
                <p className="mt-2">
                  Each step references the same authority record, preserving continuity across the
                  loop.
                </p>
              </div>
              <div className="rounded-lg border border-neutral-200/80 bg-neutral-50 p-4">
                <p className="font-medium text-neutral-700">Compliance posture</p>
                <p className="mt-2">
                  Audit references, signatures, and explicit acceptance remain visible without
                  exposing sensitive data.
                </p>
              </div>
              <div className="rounded-lg border border-neutral-200/80 bg-neutral-50 p-4">
                <p className="font-medium text-neutral-700">No live data</p>
                <p className="mt-2">All values are placeholders for demo walkthrough only.</p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
