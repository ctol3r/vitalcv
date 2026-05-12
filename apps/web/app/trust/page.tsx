import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Trust Center — VitalCV',
  description:
    'VitalCV trust infrastructure: DID document, JWKS endpoint, and credential verification details.',
};

export default function TrustPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Trust Center</h1>
      <p className="mb-10 text-gray-500">
        VitalCV credentials are cryptographically signed and independently verifiable.
      </p>

      <section className="mb-10 space-y-4">
        <h2 className="text-xl font-semibold">Issuer Identity</h2>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="mb-2 flex items-start gap-2">
            <span className="min-w-[120px] text-sm font-medium text-gray-600">DID</span>
            <code className="break-all font-mono text-sm">did:web:vitalcv.com</code>
          </div>
          <div className="flex items-start gap-2">
            <span className="min-w-[120px] text-sm font-medium text-gray-600">Method</span>
            <span className="text-sm">
              <a
                href="https://w3c-ccg.github.io/did-method-web/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                did:web
              </a>{' '}
              — W3C standard decentralized identifier
            </span>
          </div>
        </div>
      </section>

      <section className="mb-10 space-y-4">
        <h2 className="text-xl font-semibold">Trust Endpoints</h2>
        <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
          {[
            { label: 'DID Document', path: '/.well-known/did.json' },
            { label: 'JWKS (Public Keys)', path: '/.well-known/jwks.json' },
            { label: 'OID4VCI Issuer Metadata', path: '/.well-known/openid-credential-issuer' },
            { label: 'Trust Manifest', path: '/.well-known/trust.json' },
          ].map(({ label, path }) => (
            <div key={path} className="flex items-center gap-2">
              <span className="min-w-[200px] text-sm font-medium text-gray-600">{label}</span>
              <a
                href={path}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-blue-600 underline"
              >
                {path}
              </a>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10 space-y-4">
        <h2 className="text-xl font-semibold">Credential Types</h2>
        <ul className="list-disc rounded-lg border border-gray-200 bg-gray-50 px-8 py-4 text-sm">
          <li>
            <code>VerifiableCredential</code> — W3C base type
          </li>
          <li>
            <code>VitalCVCredential</code> — VitalCV credentialing assertion
          </li>
        </ul>
      </section>

      <section className="mb-10 space-y-4">
        <h2 className="text-xl font-semibold">Verification Instructions</h2>
        <ol className="list-decimal space-y-2 rounded-lg border border-gray-200 bg-gray-50 px-8 py-4 text-sm">
          <li>Obtain the JWT credential from your VitalCV provider passport.</li>
          <li>
            Fetch the public key from{' '}
            <a
              href="/.well-known/jwks.json"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              /.well-known/jwks.json
            </a>{' '}
            and match by <code>kid</code>.
          </li>
          <li>Verify the ES256 signature using the matched public key.</li>
          <li>
            Check <code>iss</code> equals <code>https://vitalcv.com</code> and <code>exp</code> is
            in the future.
          </li>
          <li>
            Inspect the <code>vcv</code> claim block for source, status, and observed_at.
          </li>
        </ol>
      </section>

      <div className="rounded-lg border border-blue-100 bg-blue-50 px-6 py-4">
        <p className="mb-2 text-sm font-medium text-blue-900">Verify a credential now</p>
        <p className="mb-3 text-sm text-blue-700">
          Paste a JWT to check its signature, expiry, and claims interactively.
        </p>
        <Link
          href="/verify"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Go to Verifier →
        </Link>
      </div>
    </main>
  );
}
