import type { Metadata } from 'next';
import Link from 'next/link';

const guarantees = [
  {
    label: 'Crypto',
    description: 'ES256-only signing, strict alg enforcement, and deterministic key handling.',
  },
  {
    label: 'OAuth/OIDC',
    description: 'OpenID4VCI issuance, OpenID4VP presentation, and PKCE S256 flows where applicable.',
  },
  {
    label: 'Transport',
    description: 'DPoP for token-bound requests and no plain-client secret logging in browser code.',
  },
  {
    label: 'Monitoring',
    description: 'Uptime checks, drift monitoring, and operational status signals exposed via API.',
  },
];

const threats = [
  {
    threat: 'Credential forgery',
    mitigation: "Every artifact is signed with ES256 (P-256). Verifiers check the JWS compact serialization against VitalCV's published JWKS endpoint.",
  },
  {
    threat: 'Stale or tampered data',
    mitigation: 'Artifact payloads include a SHA-256 hash of the raw NPPES response captured at issuance time. Any mutation invalidates the hash chain.',
  },
  {
    threat: 'Replay attacks',
    mitigation: 'Single-use nonces and DPoP token binding ensure that credentials cannot be replayed across sessions or verifiers.',
  },
  {
    threat: 'Unauthorized verification',
    mitigation: 'Verifier endpoints require API key authentication and tenant context. Demo routes are rate-limited and return read-only data.',
  },
  {
    threat: 'Man-in-the-middle',
    mitigation: "All API traffic is TLS-only. DPoP binds access tokens to the client's key pair, preventing token interception.",
  },
  {
    threat: 'Key compromise',
    mitigation: 'Signing keys are rotated via kid versioning. Expired key IDs are rejected at verification time. Key material never leaves the server.',
  },
];

const enforcements = [
  'ES256 (P-256) as the only signing algorithm — no RSA, no HS256, no "none".',
  'Append-only transparency log for all issued artifacts.',
  'DPoP token binding on all verifier-facing flows.',
  'PKCE S256 on all OAuth authorization code flows.',
  'Rate limiting at the IP level on all public-facing routes.',
  'Content-Security-Policy and CORS restricted to known origins.',
  'No secrets in client bundles — all signing is server-side.',
];

export const metadata: Metadata = {
  title: 'Security posture — VitalCV',
  description: "Concrete security guarantees and threat model for VitalCV's healthcare credentialing pipeline.",
  openGraph: {
    title: 'Security posture — VitalCV',
    description: 'No shortcuts. No weak defaults. ES256 signing, OpenID4VCI, PKCE S256, and DPoP token binding.',
    url: 'https://vitalcv.com/security',
  },
  twitter: {
    title: 'Security posture — VitalCV',
    description: 'ES256 signing, OpenID4VCI, PKCE S256, and DPoP token binding.',
  },
};

function GuaranteeCard({ label, description }: { label: string; description: string }) {
  return (
    <article className="rounded-lg border border-border p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        {label}
      </h2>
      <p className="mt-3 text-base leading-relaxed text-foreground">{description}</p>
    </article>
  );
}

export default function SecurityPage() {
  return (
    <main className="bg-background">
      {/* ── Hero ── */}
      <section className="mx-auto max-w-[1200px] px-6 pt-20 pb-12 md:pt-28">
        <p className="text-sm uppercase tracking-[0.2em] text-muted">
          Security
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          No shortcuts. No weak defaults.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">
          We publish concrete guarantees so operators, investors, and verifiers can
          validate behavior quickly.
        </p>
        <Link
          href="/demo"
          className="mt-8 inline-flex rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-theme hover:opacity-90"
        >
          Try demo
        </Link>
      </section>

      {/* ── Guarantee cards ── */}
      <section className="border-y border-border bg-surface py-14">
        <div className="mx-auto grid max-w-[1200px] gap-4 px-6 md:grid-cols-2">
          {guarantees.map((g) => (
            <GuaranteeCard key={g.label} label={g.label} description={g.description} />
          ))}
        </div>
      </section>

      {/* ── Threat model ── */}
      <section className="mx-auto max-w-[1200px] px-6 py-14">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted">
          Threat model
        </h2>
        <p className="mt-4 text-2xl font-semibold text-foreground">
          What we protect against
        </p>
        <div className="mt-8 space-y-4">
          {threats.map((t) => (
            <div key={t.threat} className="rounded-lg border border-border p-5">
              <p className="text-sm font-semibold text-foreground">{t.threat}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{t.mitigation}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── What we enforce ── */}
      <section className="border-t border-border bg-surface py-14">
        <div className="mx-auto max-w-[1200px] px-6">
          <h2 className="text-sm uppercase tracking-[0.2em] text-muted">
            Enforcement
          </h2>
          <p className="mt-4 text-2xl font-semibold text-foreground">
            What we enforce
          </p>
          <ul className="mt-6 space-y-3">
            {enforcements.map((e) => (
              <li key={e} className="flex items-start gap-3 text-sm leading-relaxed text-foreground">
                <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                {e}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
