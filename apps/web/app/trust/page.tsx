import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trust & Security | VitalCV',
  description: 'How VitalCV handles data, security, and privacy.',
};

export default function TrustPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
      <h1 className="text-3xl font-bold mb-8">Trust & Security</h1>
      
      <div className="space-y-8 text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">No PHI Stored</h2>
          <p>
            VitalCV is a credential readiness and pre-screening platform. We do not store, process, or transmit Protected Health Information (PHI). Our systems are designed exclusively for public and non-sensitive credential data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Public Data Sources Only</h2>
          <p>
            We aggregate data from federal and state public sources such as NPPES, OIG LEIE, and PECOS. We do not perform deep background checks or access private consumer data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Audit Logging</h2>
          <p>
            All verifications and system actions are securely logged. We maintain audit trails to ensure compliance, debugging, and security monitoring.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Data Retention</h2>
          <p>
            Public credential data is cached for performance and accuracy but can be refreshed or removed upon request. We retain account and log data only as long as necessary to provide our services.
          </p>
        </section>
      </div>
    </div>
  );
}
