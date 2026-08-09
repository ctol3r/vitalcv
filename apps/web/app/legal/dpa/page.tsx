import React from 'react';
import type { Metadata } from 'next';
import { LegalShell } from '@/components/legal/LegalShell';

export const metadata: Metadata = {
  title: 'Data Processing Agreement Template',
  description:
    'Template Data Processing Agreement for use with VitalCV. This is not a binding agreement; review with your legal team before use.',
};

const EFFECTIVE_DATE = '2026-05-01';

export default function DpaPage() {
  return (
    <LegalShell activeDoc="dpa" eyebrow="Legal" title="Data Processing Agreement" updated={EFFECTIVE_DATE}>
      {/* Truth-contract banner: not a binding agreement */}
      <div
        role="note"
        aria-label="Template disclaimer"
        className="mt-2 mb-2 rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-300"
      >
        <strong>This document is a template for review by your legal team.</strong>{' '}
        It is not a binding agreement. It has not been reviewed by legal counsel and
        does not constitute legal advice. Do not rely on this template without
        independent legal review specific to your jurisdiction and use case.
      </div>

      <div className="prose prose-sm max-w-none text-foreground">
        <section className="mb-8">
          <h2 className="text-lg font-semibold">1. Parties</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            This Data Processing Agreement (&ldquo;DPA&rdquo;) is entered into between the
            Controller (the organization or individual using VitalCV services) and VitalCV,
            Inc. (&ldquo;Processor&rdquo;). The Controller and Processor are each a
            &ldquo;Party&rdquo; and together the &ldquo;Parties.&rdquo;
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold">2. Subject Matter and Duration</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The Processor provides credentialing workflow software services as described in
            the applicable Service Agreement. Processing is performed for the duration of the
            Service Agreement, unless otherwise agreed in writing.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold">3. Nature and Purpose of Processing</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The Processor processes personal data on behalf of the Controller to provide
            healthcare credentialing workflow features, including primary source verification
            coordination, credential tracking, and audit trail generation. The Processor
            does not process personal data for its own independent purposes.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold">4. Categories of Data Subjects and Personal Data</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Data subjects may include clinicians, trainees, and other healthcare personnel
            whose credentials are being verified. Personal data processed may include names,
            National Provider Identifiers (NPIs), license numbers, employment history,
            education history, and other credentialing information provided by the Controller
            or the data subject.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold">5. Processor Obligations</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>Process personal data only on documented instructions from the Controller.</li>
            <li>Ensure persons authorized to process data are bound by confidentiality.</li>
            <li>Implement appropriate technical and organizational measures to protect data.</li>
            <li>Assist the Controller in responding to data subject rights requests.</li>
            <li>Delete or return all personal data upon termination of the Service Agreement.</li>
            <li>Provide information necessary to demonstrate compliance with applicable law.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold">6. Sub-processors</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The Processor may engage sub-processors to assist in providing the services.
            Current sub-processors include infrastructure providers (cloud hosting, databases),
            authentication services, and error monitoring services. The Processor will notify
            the Controller of any intended changes to sub-processors.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold">7. Data Security</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The Processor implements technical and organizational measures appropriate to the
            risk of processing, including encryption in transit and at rest, access controls,
            and audit logging. The Processor does not guarantee any specific security standard
            or certification through this template.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold">8. International Transfers</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Where personal data is transferred outside the jurisdiction of the Controller,
            the Parties will implement appropriate transfer mechanisms as required by
            applicable law. This template does not itself constitute a valid transfer mechanism.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold">9. Limitation</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            This template does not constitute legal, compliance, or regulatory advice.
            It does not make any representation that use of VitalCV services satisfies
            any regulatory requirement. Compliance determinations are the responsibility
            of the Controller and its legal counsel.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold">10. Contact</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Questions about data processing practices:{' '}
            <a
              href="mailto:privacy@vitalcv.com"
              className="underline hover:text-foreground"
            >
              privacy@vitalcv.com
            </a>
          </p>
        </section>
      </div>

      <footer className="mt-12 border-t pt-6 text-xs leading-relaxed text-muted-foreground">
        This page was last updated {EFFECTIVE_DATE}. It is a template document only and
        does not constitute a binding Data Processing Agreement without separate execution
        by authorized representatives of both parties.
      </footer>
    </LegalShell>
  );
}
