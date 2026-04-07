import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'OpenID4VC Self-Certification',
  description: 'VitalCV OpenID for Verifiable Credentials self-certification status.',
  robots: { index: false },
};

export default function OpenIdSelfCertPage() {
  return (
    <article className="max-w-2xl space-y-10">
      <header className="space-y-4">
        <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-3)]">
          Self-Certification
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--vt-text-1)]">
          OpenID4VC Compliance
        </h1>
        <p className="text-[var(--vt-text-2)] leading-relaxed">
          VitalCV implements the OpenID for Verifiable Credentials specification for
          credential issuance and presentation. Self-certification testing is in progress.
        </p>
      </header>

      <section className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-6 space-y-4">
        <h2 className="text-sm font-semibold text-[var(--vt-text-1)]">Certification Status</h2>
        <div className="space-y-2">
          {[
            { check: 'Metadata lint', status: 'Pending' },
            { check: 'JWKS validation', status: 'Pending' },
            { check: 'Pre-authorized flow', status: 'Pending' },
            { check: 'Authorization code flow', status: 'Pending' },
            { check: 'Credential issuance', status: 'Pending' },
            { check: 'Credential presentation', status: 'Pending' },
          ].map(({ check, status }) => (
            <div
              key={check}
              className="flex items-center justify-between rounded-lg border border-[var(--vt-border)] px-4 py-2.5"
            >
              <span className="text-sm text-[var(--vt-text-2)]">{check}</span>
              <span className="font-mono text-xs text-amber-500">{status}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--vt-text-3)]">
          Self-certification runs are managed internally. Contact the team for the latest results.
        </p>
      </section>
    </article>
  );
}
