import * as React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'VitalCV Privacy Policy.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">
          Pilot product · informational
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Privacy
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Last Updated: {new Date().toISOString().slice(0, 10)}
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground" data-testid="privacy-informational-disclaimer">
          This page is an informational pilot-product privacy note — it is not a final
          legal policy. The signed pilot scope document controls the specifics for any
          active engagement, and no warranty is implied by the summary below.
        </p>
        <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Information We Collect</h2>
            <p>
              We collect information that you provide directly to us when using the VitalCV platform. This may include National Provider Identifiers (NPIs) and other credentialing-related data. We also collect data from public and primary sources (such as NPPES, OIG LEIE, and PECOS) to compile readiness snapshots.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. How We Use Information</h2>
            <p>
              The information collected is used to generate source-backed credentialing packets, measure readiness, and facilitate the onboarding review process for employers and clinicians. We do not sell your personal data.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Data Security</h2>
            <p>
              We use standard, verifiable digital signatures and encryption to protect the integrity of the data we pull and the audit envelopes we generate.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at privacy@vitalcv.com.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
