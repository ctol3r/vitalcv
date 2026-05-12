'use client';

/**
 * TrustRegistryFooter.tsx
 *
 * Appended below TrustStateRegister on /trust page.
 * Declares doctrine, infrastructure continuity, verifier guarantees,
 * and machine-readable endpoint index.
 */

// ─── Section subcomponents ────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
      {children}
    </h3>
  );
}

function DoctrineRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start gap-2 text-xs py-1 border-b border-gray-100 last:border-0">
      <span className="w-52 shrink-0 text-gray-500">{label}</span>
      <span className={valueClass ?? 'text-gray-800 font-medium'}>{value}</span>
    </div>
  );
}

function InfraRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex items-start gap-2 text-xs py-1 border-b border-gray-100 last:border-0">
      <span className="w-40 shrink-0 text-gray-500">{label}</span>
      <span className="font-mono text-gray-800">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 text-blue-700 hover:text-blue-900"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </span>
    </div>
  );
}

interface EndpointRow {
  path: string;
  description: string;
  auth: string;
}

const ENDPOINTS: EndpointRow[] = [
  {
    path: '/.well-known/jwks.json',
    description: 'Public signing keys',
    auth: 'None',
  },
  {
    path: '/.well-known/did.json',
    description: 'W3C DID document',
    auth: 'None',
  },
  {
    path: '/.well-known/openid-credential-issuer',
    description: 'OID4VCI metadata',
    auth: 'None',
  },
  {
    path: '/.well-known/trust.json',
    description: 'Trust manifest',
    auth: 'None',
  },
  {
    path: '/.well-known/trust-register',
    description: 'Machine-readable doctrine',
    auth: 'None',
  },
  {
    path: '/api/receipts/verify',
    description: 'Verify a receipt JWT',
    auth: 'None',
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export function TrustRegistryFooter() {
  return (
    <div className="mt-8 space-y-8 border-t border-gray-200 pt-8">
      {/* ── Section 1: Trust Doctrine ─────────────────────────────────────── */}
      <section>
        <SectionHeading>Trust Doctrine</SectionHeading>
        <div className="border border-gray-200 rounded divide-y divide-gray-100">
          <DoctrineRow
            label="Anonymous reads"
            value="PUBLIC"
            valueClass="text-green-700 font-semibold"
          />
          <DoctrineRow
            label="Anonymous writes"
            value="REJECTED — 401"
            valueClass="text-red-700 font-semibold"
          />
          <DoctrineRow
            label="Authenticated writes"
            value="ATTRIBUTABLE — actor_id required"
            valueClass="text-blue-700 font-semibold"
          />
          <DoctrineRow
            label="Replay lineage"
            value="COHERENT — Prisma upsert, dedupeKey"
            valueClass="text-gray-800 font-medium"
          />
          <DoctrineRow
            label="Verifier continuity"
            value="PUBLIC — no auth required"
            valueClass="text-green-700 font-semibold"
          />
          <DoctrineRow
            label="Signed issuance"
            value="ATTRIBUTABLE — azp + vcv.actor_id in JWT"
            valueClass="text-gray-800 font-medium"
          />
          <DoctrineRow
            label="Degraded-state semantics"
            value="EXPLICIT — dashed borders, no opacity"
            valueClass="text-gray-800 font-medium"
          />
        </div>
      </section>

      {/* ── Section 2: Infrastructure Continuity ──────────────────────────── */}
      <section>
        <SectionHeading>Infrastructure Continuity</SectionHeading>
        <div className="border border-gray-200 rounded divide-y divide-gray-100">
          <InfraRow
            label="Signer"
            value="ES256 — did:web:vitalcv.com"
            href="/.well-known/jwks.json"
          />
          <InfraRow
            label="DID"
            value="did:web:vitalcv.com"
            href="/.well-known/did.json"
          />
          <InfraRow
            label="Replay survivability"
            value="Confirmed — Prisma upsert deduplication"
          />
          <InfraRow label="Receipt continuity" value="Active" />
        </div>
      </section>

      {/* ── Section 3: Verifier Guarantees ───────────────────────────────── */}
      <section>
        <SectionHeading>Verifier Guarantees</SectionHeading>
        <div className="border border-gray-200 rounded p-4 space-y-2">
          {[
            'You can verify any VitalCV receipt without contacting VitalCV.',
            'Public key published at /.well-known/jwks.json.',
            'DID document at /.well-known/did.json.',
            'No API key required for verification.',
          ].map((g) => (
            <div key={g} className="flex items-start gap-2 text-xs text-gray-700">
              <span className="mt-0.5 text-green-600 font-bold shrink-0">✓</span>
              <span>{g}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 4: Machine-Readable Links ────────────────────────────── */}
      <section>
        <SectionHeading>Machine-Readable Endpoints</SectionHeading>
        <div className="border border-gray-200 rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-gray-500 font-mono">
                  Endpoint
                </th>
                <th className="text-left px-3 py-2 font-semibold text-gray-500">
                  Description
                </th>
                <th className="text-left px-3 py-2 font-semibold text-gray-500">
                  Auth
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ENDPOINTS.map((ep) => (
                <tr key={ep.path} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-blue-700">
                    <a
                      href={ep.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {ep.path}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-gray-700">{ep.description}</td>
                  <td className="px-3 py-2 text-gray-500">{ep.auth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default TrustRegistryFooter;
