import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'SDKs | VitalCV Docs',
  description: 'Official VitalCV client libraries for Node.js, Python, and Go.',
};

const SDKS = [
  {
    id: 'node',
    lang: 'Node.js',
    pkg: '@vitalcv/verifier-sdk',
    badge: 'TypeScript',
    badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    install: 'pnpm add @vitalcv/verifier-sdk',
    example: `import { VitalCVVerifier } from '@vitalcv/verifier-sdk';

const verifier = new VitalCVVerifier({
  apiKey: process.env.VITALCV_API_KEY,
});

// Verify a clinician by NPI
const result = await verifier.verify('1234567890');
console.log(result.trustBand); // 'L3' | 'L2' | 'L1' | 'L0'
console.log(result.credentials);`,
    methods: ['verify(npi)', 'verifyBundle(credentials)', 'acceptPresentation(presentationId)', 'verifyWebhookSignature(rawBody, sig, secret)', 'listPending()'],
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
  apiKey: process.env.VITALCV_ISSUER_KEY,
  did: 'did:vitalcv:issuer:ca-medical-board',
});

// Issue a medical license credential
const credential = await issuer.issue({
  subjectNpi: '1234567890',
  type: 'medical_license',
  claims: { state: 'CA', licenseNumber: 'A123456', specialty: 'Internal Medicine' },
});`,
    methods: ['issue(payload)', 'revoke(credentialId, reason)', 'listIssued()', 'register()'],
  },
  {
    id: 'wallet',
    lang: 'Wallet SDK',
    pkg: '@vitalcv/wallet-sdk',
    badge: 'TypeScript',
    badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    install: 'pnpm add @vitalcv/wallet-sdk',
    example: `import { VitalCVWallet } from '@vitalcv/wallet-sdk';

const wallet = new VitalCVWallet({ holderId: 'npi:1234567890' });

// Store a received credential
await wallet.store(credential);

// Generate selective disclosure — reveal only specialty
const presentation = await wallet.present(credentialId, {
  revealClaims: ['specialty', 'licenseNumber'],
});`,
    methods: ['store(credential)', 'list()', 'present(id, options)', 'remove(id)', 'getWalletSummary()'],
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
          Three focused TypeScript SDKs — verifier, issuer, and wallet. Each ships with full type definitions,
          version compatibility checks, and built-in diagnostics.
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
                <code key={m} className="text-xs px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-zinc-300 font-mono">
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
        <Link href="/docs/api" className="text-zinc-400 hover:text-white transition-colors">← API Reference</Link>
        <Link href="/docs/webhooks" className="text-sky-400 hover:text-sky-300 transition-colors">Webhooks →</Link>
      </div>
    </div>
  );
}
