import * as React from 'react';
import type { Metadata } from 'next';
import { LegalShell } from '@/components/legal/LegalShell';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'VitalCV Privacy Policy.',
};

export default function PrivacyPage() {
  return (
    <LegalShell
      activeDoc="privacy"
      eyebrow="Pilot product · informational"
      title="Privacy"
      updated={new Date().toISOString().slice(0, 10)}
    >
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
    </LegalShell>
  );
}
