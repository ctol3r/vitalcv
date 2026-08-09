import * as React from 'react';
import type { Metadata } from 'next';
import { LegalShell } from '@/components/legal/LegalShell';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'VitalCV Terms of Service.',
};

export default function TermsPage() {
  return (
    <LegalShell
      activeDoc="terms"
      eyebrow="Pilot product · informational"
      title="Terms"
      // The page previously stamped `new Date()` — claiming it was updated
      // today, every day. This is the last date the TEXT actually changed;
      // move it when the text moves.
      updated="2026-07-12"
    >
      <p className="mt-2 text-sm leading-6 text-muted-foreground" data-testid="terms-informational-disclaimer">
        This page is an informational summary of how the VitalCV pilot product works —
        it is not a final legal agreement. No warranties are implied. The signed
        pilot scope document executed between VitalCV and the buyer is the controlling
        agreement for any active engagement.
      </p>
      <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
          <p>
            By accessing or using the VitalCV platform, you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use our services.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">2. Description of Service</h2>
          <p>
            VitalCV provides a platform for assembling, verifying, and reviewing clinician credentialing readiness packets. Our service does not replace your credentialing committee or final privileging decisions.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">3. Use of the Service</h2>
          <p>
            You agree to use the service only for lawful purposes and in accordance with these Terms. You are responsible for ensuring that your use of the service complies with all applicable laws and regulations.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">4. Limitation of Liability</h2>
          <p>
            VitalCV shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">5. Contact Us</h2>
          <p>
            If you have any questions about these Terms, please contact us at support@vitalcv.com.
          </p>
        </section>
      </div>
    </LegalShell>
  );
}
