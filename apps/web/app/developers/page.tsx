/**
 * Developer Portal — Wave 30: The API Wedge
 *
 * Wide-canvas, Stripe-tier developer dashboard using the Antigravity Aesthetic:
 * tactile grain (from layout.tsx), dark glass surfaces, emerald glow accents.
 *
 * Server component — all three panels are client components with their own
 * 'use client' boundaries, so this page itself has zero hydration risk.
 */

import React from 'react';
import { ApiKeyManager } from '@/components/developers/ApiKeyManager';
import { ApiSandbox } from '@/components/developers/ApiSandbox';
import { ConformanceReport } from '@/components/developers/ConformanceReport';
import { DropInSection } from '@/components/developers/DropInSection';
import { HealthStartDocs } from '@/components/developers/HealthStartDocs';
import { SdkDocs } from '@/components/developers/SdkDocs';
import { WebhookLog } from '@/components/developers/WebhookLog';
import { GatewayConnections } from '@/components/network/GatewayConnections';
import { getPublicApiBase, getPublicApiHostLabel } from '@/lib/api';
import {
    ArrowRight,
    BookOpen,
    Code2,
    GitBranch,
    Globe,
    Lock,
    Webhook,
    Zap,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Developer Portal | VitalCV',
  description:
    'Current VitalCV API routes, SDKs, and webhook registration surfaces backed by this branch.',
};

// ── Quick-stat cards ──────────────────────────────────────────────────────

function buildDeveloperPortalStats() {
  return [
    { icon: Globe, label: 'API Host', value: getPublicApiHostLabel() },
    { icon: GitBranch, label: 'Route Prefix', value: '/api' },
    { icon: Lock, label: 'Auth', value: 'API keys' },
    { icon: Zap, label: 'Mode', value: 'Preview' },
  ] as const;
}

// ── Resource links ────────────────────────────────────────────────────────

const RESOURCES = [
  { icon: BookOpen, label: 'API Reference',   href: '/docs/api',      desc: 'Current route guide plus API-host links' },
  { icon: Code2,    label: 'SDKs',            href: '/docs/sdk',      desc: 'Workspace SDK packages for verifier, issuer, and wallet flows'    },
  { icon: Webhook,  label: 'Webhook Guide',   href: '/docs/webhooks', desc: 'Registration route, event catalog, and signatures'    },
  { icon: Lock,     label: 'Wallet Export',   href: '/docs/api',      desc: 'CHAPI and SMART Health Card export routes when wallet export is enabled'   },
  { icon: Globe,    label: 'Compliance API',  href: '/docs/api',      desc: 'Compliance and emergency-readiness routes exposed by the current backend'         },
  { icon: GitBranch, label: 'Examples',       href: 'https://github.com/ctol3r/vitalcv/tree/main/examples', desc: 'ATS integration, webhook verification' },
];

// ── Page ──────────────────────────────────────────────────────────────────

export default function DeveloperPortalPage() {
  const stats = buildDeveloperPortalStats();
  const publicApiBase = getPublicApiBase();

  return (
    <div className="min-h-screen bg-ops-gradient text-white">
      {/* ── Hero header ──────────────────────────────────── */}
      <header className="relative overflow-hidden border-b border-vt-neutral-800 px-6 py-20 text-center">
        {/* Ambient glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 50% 0%, oklch(0.68 0.12 180 / 0.12), transparent 70%)',
            filter: 'blur(40px)',
          }}
        />

        <div className="relative z-10 mx-auto max-w-3xl">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-vt-success/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-vt-success ring-1 ring-vt-success/30">
            <Code2 className="h-3.5 w-3.5" />
            Developer Portal
          </span>

          <h1 className="heading-xl mt-4 text-white">
            Build against the
            <br />
            <span className="text-vt-success">current VitalCV API.</span>
          </h1>

          <p className="body-lg mt-5 text-vt-neutral-200 max-w-xl mx-auto">
            Use the configured API host, workspace SDKs, and backend routes that exist in this branch. Sample snippets stay explicit when they are illustrative rather than proof of a live end-to-end workflow.
          </p>

          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="#sandbox"
              className="inline-flex items-center gap-2 rounded-xl bg-vt-success px-6 py-3 text-sm font-bold text-black shadow-lg shadow-vt-success/20 transition hover:bg-vt-success"
            >
              Try the Sandbox
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-xl vt-glass px-6 py-3 text-sm font-semibold text-white transition hover:bg-vt-surface-ops-raised"
            >
              <BookOpen className="h-4 w-4" />
              Read the Docs
            </Link>
          </div>
        </div>
      </header>

      {/* ── Stats row ────────────────────────────────────── */}
      <div className="border-b border-vt-neutral-800 bg-vt-surface-ops-raised/40">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y divide-white/8 md:grid-cols-4 md:divide-y-0">
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 px-8 py-5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-vt-success/10 text-vt-success">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-vt-neutral-800">{label}</p>
                <p className="text-sm font-semibold text-white">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────── */}
      <main className="mx-auto max-w-7xl space-y-10 px-6 py-14">

        {/* Section label */}
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-vt-neutral-800">
            Developer Tools
          </p>
          <div className="vt-divider-ops" />
        </div>

        {/* Row 1: API Key + Webhook side-by-side */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <ApiKeyManager />
          <WebhookLog />
        </div>

        {/* Row 2: Full-width cURL Sandbox */}
        <div id="sandbox" className="scroll-mt-20">
          <ApiSandbox />
        </div>

        {/* Row 3: Drop-in Widget SDK — Wave 34: Plaid Wedge */}
        <DropInSection />

        {/* Row 4: Network Gateway — Wave 91 */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-vt-neutral-800">
              Network Gateway
            </p>
            <div className="vt-divider-ops" />
          </div>
          <GatewayConnections />
        </div>

        {/* ── Wave 107: Verifier SDK ──────────────────────── */}
        <div id="verifier-sdk" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-vt-neutral-800">
              Verifier SDK
            </p>
            <div className="vt-divider-ops" />
          </div>
          <div className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-6 space-y-6">
            <p className="text-sm text-vt-neutral-200">
              These examples use the current verifier SDK package and live route contracts exposed by this branch. They are sample integrations, not evidence that every downstream workflow is enabled in this environment.
            </p>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-vt-success mb-2">getPublicProfile()</p>
                <pre className="rounded-xl bg-vt-surface-ops-base border border-white/6 p-4 text-xs text-vt-neutral-200 overflow-x-auto"><code>{`import { VitalCVVerifier } from '@vitalcv/verifier-sdk';

const verifier = new VitalCVVerifier({
  baseUrl: '${publicApiBase}',
  apiKey: process.env.VITALCV_API_KEY,
});

const profile = await verifier.getPublicProfile('1234567890');
// profile: { npi, trustBand, credentials }`}</code></pre>
              </div>

              <div>
                <p className="text-xs font-semibold text-vt-success mb-2">verifyPresentation()</p>
                <pre className="rounded-xl bg-vt-surface-ops-base border border-white/6 p-4 text-xs text-vt-neutral-200 overflow-x-auto"><code>{`const result = await verifier.verifyPresentation({ vpJwt });
// result: { valid, credentials, verifiedAt, errors }`}</code></pre>
              </div>

              <div>
                <p className="text-xs font-semibold text-vt-success mb-2">checkRevocation()</p>
                <pre className="rounded-xl bg-vt-surface-ops-base border border-white/6 p-4 text-xs text-vt-neutral-200 overflow-x-auto"><code>{`const result = await verifier.checkRevocation('vc:vitalcv:12345');
// result: { revoked, reason, revokedAt }`}</code></pre>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-vt-neutral-800">
              <span className="inline-block w-2 h-2 rounded-full bg-vt-success" />
              Current routes:
              <code className="text-vt-success ml-1">GET /api/public/profile/npi/:npi</code>
              <code className="text-vt-success ml-1">POST /api/credentials/verify/presentation</code>
              <code className="text-vt-success ml-1">GET /api/revocation/:credentialId</code>
            </div>
          </div>
        </div>

        {/* ── Wave 108: Trust Governance ───────────────────── */}
        <div id="governance" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-vt-neutral-800">
              Trust Governance
            </p>
            <div className="vt-divider-ops" />
          </div>
          <div className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-6 space-y-4">
            <p className="text-sm text-vt-neutral-200">
              The configured backend exposes governance rules. The cards below summarize the current rule set in a readable form instead of implying a separate launch-only product surface.
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-white/6 bg-vt-surface-ops-base/60 p-4 space-y-2">
                <p className="text-xs font-semibold text-vt-warning">TRUST_THRESHOLD</p>
                <p className="text-sm font-semibold text-white">Minimum Issuer Trust Score</p>
                <p className="text-xs text-vt-neutral-800">Issuers with trust score below <span className="text-white font-medium">60</span> are automatically suspended pending review.</p>
                <span className="inline-block text-xs rounded-full bg-vt-danger/10 text-vt-danger border border-vt-danger/20 px-2 py-0.5">SUSPEND_ISSUER</span>
              </div>

              <div className="rounded-xl border border-white/6 bg-vt-surface-ops-base/60 p-4 space-y-2">
                <p className="text-xs font-semibold text-vt-warning">REVOCATION_ESCALATION</p>
                <p className="text-sm font-semibold text-white">Revocation Escalation</p>
                <p className="text-xs text-vt-neutral-800">Issuers exceeding <span className="text-white font-medium">5</span> revocations in a 30-day window are flagged for human review.</p>
                <span className="inline-block text-xs rounded-full bg-vt-warning/10 text-vt-warning border border-vt-warning/20 px-2 py-0.5">FLAG_FOR_REVIEW</span>
              </div>

              <div className="rounded-xl border border-white/6 bg-vt-surface-ops-base/60 p-4 space-y-2">
                <p className="text-xs font-semibold text-vt-warning">PEER_ACCEPTANCE</p>
                <p className="text-sm font-semibold text-white">Network Peer Acceptance</p>
                <p className="text-xs text-vt-neutral-800">AUTHORITATIVE issuers require endorsement from <span className="text-white font-medium">3</span> existing peers before full activation.</p>
                <span className="inline-block text-xs rounded-full bg-vt-info/10 text-vt-info border border-vt-info/20 px-2 py-0.5">REQUIRE_PEER_APPROVAL</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-vt-neutral-800">
              <span className="inline-block w-2 h-2 rounded-full bg-vt-warning" />
              API endpoint: <code className="text-vt-warning ml-1">GET /api/governance/rules</code>
            </div>
          </div>
        </div>

        {/* ── Resource links ──────────────────────────────── */}
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-vt-neutral-800">
            Resources
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {RESOURCES.map(({ icon: Icon, label, href, desc }) => (
              <Link
                key={label}
                href={href}
                className="group flex items-start gap-4 rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-5 transition hover:border-vt-success/30 hover:bg-vt-surface-ops-raised/60"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-vt-success/10 text-vt-success transition group-hover:bg-vt-success/20">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="mt-0.5 text-xs text-vt-neutral-800">{desc}</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-vt-neutral-700 transition group-hover:text-vt-success" />
              </Link>
            ))}
          </div>
        </div>
        {/* ── Wave 114: Conformance & Audit ──────────────── */}
        <div id="conformance" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-vt-neutral-800">
              Standards Conformance · Wave 114
            </p>
            <div className="vt-divider-ops" />
          </div>
          <ConformanceReport />
        </div>

        {/* ── Wave 118: HealthStart Control Inheritance ──── */}
        <div id="healthstart" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-vt-neutral-800">
              HealthStart · Wave 118
            </p>
            <div className="vt-divider-ops" />
          </div>
          <HealthStartDocs />
        </div>

        {/* ── Phase 7: SDK Documentation ─────────────────── */}
        <div id="sdks" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-vt-neutral-800">
              Developer SDKs · Phase 7
            </p>
            <div className="vt-divider-ops" />
          </div>
          <SdkDocs />
        </div>

      </main>
    </div>
  );
}
