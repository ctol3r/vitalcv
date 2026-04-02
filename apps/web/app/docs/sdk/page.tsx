import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'SDKs | VitalCV Docs',
  description: 'Current VitalCV TypeScript SDK packages for verifier, issuer, and wallet flows.',
};

const SDKS = [
  {
    id: 'verifier',
    lang: 'Verifier SDK',
    pkg: '@vitalcv/verifier-sdk',
    badge: 'TypeScript',
    badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    install: 'pnpm add @vitalcv/verifier-sdk',
    example: `import { VitalCVVerifier } from '@vitalcv/verifier-sdk';

const verifier = new VitalCVVerifier({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE!,
  apiKey: process.env.VITALCV_API_KEY,
});

// Fast trust-band check
const band = await verifier.getTrustBand('1234567890');
console.log(band.band);

// Verify a VP-JWT presentation
const result = await verifier.verifyPresentation({ vpJwt });
console.log(result.valid);`,
    methods: ['getTrustBand(npi)', 'getSubstrateTrustState(npi)', 'getPublicProfile(npi)', 'verifyPresentation({ vpJwt })', 'acceptPresentation({ presentationId })'],
  },
  {
    id: 'issuer',
    lang: 'Issuer SDK',
    pkg: '@vitalcv/issuer-sdk',
    badge: 'TypeScript',
    badgeColor: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    install: 'pnpm add @vitalcv/issuer-sdk',
    example: `import { VitalCVIssuer } from '@vitalcv/issuer-sdk';

const issuer = new VitalCVIssuer({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE!,
  apiKey: process.env.VITALCV_ISSUER_KEY,
  issuerId: 'did:vitalcv:issuer:ca-medical-board',
});

// Issue a medical license credential
const credential = await issuer.issueCredential({
  npi: '1234567890',
  credentialType: 'MedicalLicense',
  claims: { state: 'CA', licenseNumber: 'A123456', specialty: 'Internal Medicine' },
});`,
    methods: ['issueCredential(req)', 'createOID4VCICredentialOffer(req)', 'revokeCredential(credentialId, opts)', 'updateCredentialStatuses(updates)', 'registerIssuer(params)'],
  },
  {
    id: 'wallet',
    lang: 'Wallet SDK',
    pkg: '@vitalcv/wallet-sdk',
    badge: 'TypeScript',
    badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    install: 'pnpm add @vitalcv/wallet-sdk',
    example: `import { VitalCVWallet } from '@vitalcv/wallet-sdk';

const wallet = new VitalCVWallet({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE!,
  npi: '1234567890',
});

// Inspect wallet state
const summary = await wallet.getSummary();
const credentials = await wallet.listCredentials();

// Generate a presentation for a verifier
const presentation = await wallet.createPresentation({
  credentialIds: [credentials[0].credentialId],
  challenge: crypto.randomUUID(),
});`,
    methods: ['getSummary()', 'listCredentials(filter?)', 'createPresentation(req)', 'presentSelectiveDisclosure(req)', 'respondToOID4VPRequest(req)', 'getTrustState()'],
  },
];

const VERSION_TABLE = [
  { sdk: '@vitalcv/verifier-sdk', version: '1.0.0', apiCompat: '>=1.0.0', node: '>=18' },
  { sdk: '@vitalcv/issuer-sdk',   version: '1.0.0', apiCompat: '>=1.0.0', node: '>=18' },
  { sdk: '@vitalcv/wallet-sdk',   version: '1.0.0', apiCompat: '>=1.0.0', node: '>=18' },
];

export default function SdkDocsPage() {
  return (
    <div className="space-y-16 max-w-4xl">
      {/* Header */}
      <div>
        <p className="text-xs font-mono uppercase tracking-widest text-emerald-400 mb-3">SDKs</p>
        <h1 className="text-3xl font-bold tracking-tight mb-4">Client Libraries</h1>
        <p className="text-zinc-400 leading-relaxed">
          Three focused TypeScript SDKs ship in this workspace: verifier, issuer, and wallet. The examples below reflect the current package APIs, and environment-specific flows still depend on the backend routes and credentials available in your deployment.
        </p>
      </div>

      {/* SDK cards */}
      {SDKS.map((sdk) => (
        <div key={sdk.id} id={sdk.id} className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">{sdk.lang}</h2>
            <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${sdk.badgeColor}`}>{sdk.badge}</span>
          </div>

          {/* Install */}
          <div className="rounded-lg border border-white/5 bg-black/40 px-4 py-3">
            <p className="text-xs text-zinc-600 font-mono mb-1">Install</p>
            <code className="text-sm text-emerald-300 font-mono">{sdk.install}</code>
          </div>

          {/* Code example */}
          <div className="rounded-lg border border-white/5 bg-black/60 overflow-hidden">
            <div className="px-4 py-2 border-b border-white/5 flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              </div>
              <span className="text-xs font-mono text-zinc-600">example.ts</span>
            </div>
            <pre className="px-5 py-4 text-sm font-mono text-zinc-300 overflow-x-auto leading-relaxed">
              <code>{sdk.example}</code>
            </pre>
          </div>

          {/* Methods */}
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-zinc-600 mb-2">Key Methods</p>
            <div className="flex flex-wrap gap-2">
              {sdk.methods.map((m) => (
                <code key={m} className="text-xs px-2.5 py-1 rounded-md bg-muted border border-white/5 text-zinc-300 font-mono">
                  {m}
                </code>
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* Version compatibility */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Version Compatibility</h2>
        <div className="rounded-xl border border-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/2">
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Package</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Version</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">API Compat</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Node</th>
              </tr>
            </thead>
            <tbody>
              {VERSION_TABLE.map((row) => (
                <tr key={row.sdk} className="border-b border-white/3 hover:bg-white/2">
                  <td className="px-4 py-3 font-mono text-violet-300 text-xs">{row.sdk}</td>
                  <td className="px-4 py-3 text-zinc-300">{row.version}</td>
                  <td className="px-4 py-3 text-emerald-400 font-mono text-xs">{row.apiCompat}</td>
                  <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{row.node}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diagnostics note */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-sm">
        <p className="font-semibold text-emerald-300 mb-1">Built-in diagnostics</p>
        <p className="text-zinc-400">
          Each SDK exports <code className="text-emerald-300">runDiagnostics()</code> — call it to verify
          the SDK is correctly configured and API-compatible. Results available at{' '}
          <Link href="/api/mission-ops/sdk-diagnostics" className="text-emerald-400 hover:underline">/api/mission-ops/sdk-diagnostics</Link>.
        </p>
      </div>

      {/* Footer nav */}
      <div className="flex justify-between text-sm">
        <Link href="/docs/api" className="text-zinc-400 hover:text-foreground transition-colors">← API Reference</Link>
        <Link href="/docs/webhooks" className="text-sky-400 hover:text-sky-300 transition-colors">Webhooks →</Link>
      </div>
    </div>
  );
}
