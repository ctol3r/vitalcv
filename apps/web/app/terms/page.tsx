import * as React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'VitalCV Terms of Service.',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">
          Pilot product · informational
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Terms
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Last Updated: {new Date().toISOString().slice(0, 10)}
        </p>
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
      </div>
    </main>
  );
}
