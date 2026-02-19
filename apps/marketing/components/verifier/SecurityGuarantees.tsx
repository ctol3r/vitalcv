const guarantees = [
  {
    label: 'ES256-only signing',
    detail:
      'All credentials signed with ECDSA P-256. No RSA. No fallback algorithms. HAIP 1.0 mandated.',
  },
  {
    label: 'HAIP 1.0 enforcement',
    detail:
      'High Assurance Interoperability Profile enforced at every protocol layer. Immutable configuration.',
  },
  {
    label: 'Nonce lifecycle',
    detail:
      'Single-use nonces with TTL expiry. Consumed on first use, deleted from store. No replay possible.',
  },
  {
    label: 'Replay detection',
    detail:
      'DPoP JTI replay table with service-scoped composite keys. 5-minute sliding window. Prisma-backed.',
  },
  {
    label: 'Zero-trust token binding',
    detail:
      'Every access token is sender-constrained via DPoP proof-of-possession. PKCE S256 on all grants.',
  },
  {
    label: 'No PHI on-chain',
    detail:
      'Verification artifacts contain credential status only. No protected health information is stored or transmitted.',
  },
];

export function SecurityGuarantees() {
  return (
    <section className="border-t border-border py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
          Security guarantees
        </h2>
        <p className="mt-4 max-w-xl text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          Hardened by default. Audited to the wire.
        </p>

        <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2">
          {guarantees.map((item) => (
            <div key={item.label} className="bg-background p-6 md:p-8">
              <p className="text-sm font-semibold text-foreground">
                {item.label}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
