const standards = [
  {
    label: 'OpenID4VCI',
    detail: 'Credential issuance over standard OAuth 2.0 flows',
  },
  {
    label: 'HAIP 1.0',
    detail: 'High Assurance Interoperability Profile — strict enforcement',
  },
  {
    label: 'ES256-only',
    detail: 'Elliptic curve signatures. No RSA. No fallback.',
  },
  {
    label: 'Nonce lifecycle',
    detail: 'Single-use nonces with replay detection and expiry',
  },
  {
    label: 'DPoP + PKCE',
    detail: 'Proof-of-possession token binding with S256 code challenge',
  },
];

export function SecurityStandards() {
  return (
    <section className="border-t border-border bg-surface py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
          Security & Standards
        </h2>
        <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          No shortcuts. No weak defaults.
        </p>

        <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
          {standards.map((item) => (
            <div
              key={item.label}
              className="bg-background p-6 md:p-8"
            >
              <p className="text-sm font-semibold text-foreground">
                {item.label}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {item.detail}
              </p>
            </div>
          ))}
          {/* Empty cell to complete 2x3 grid */}
          <div className="hidden bg-background p-6 md:block md:p-8" />
        </div>
      </div>
    </section>
  );
}
