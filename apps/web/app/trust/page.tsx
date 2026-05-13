/**
 * /trust — Institutional trust overview surface.
 *
 * The single public page where an institutional verifier (NCQA, Joint
 * Commission, hospital procurement, security engineer) lands to inspect
 * VitalCV's trust infrastructure end-to-end. Renders the same data the
 * machine-readable `/.well-known/trust-register` surface (#349) emits,
 * laid out for a human reader in the institutional register: monochrome,
 * mono identifiers, left-aligned, no decorative iconography.
 *
 * Data source: the in-process `/.well-known/trust-register` handler is
 * called directly via dynamic import, not over HTTP. That keeps the
 * page server-rendering deterministic and avoids hostname resolution
 * concerns at SSR time.
 *
 * Section order (institutional reading order):
 *
 *   1. Issuer identity            (DID + origin + scheme version)
 *   2. Signing infrastructure      (kid, algorithm, JWKS, DID document URIs)
 *   3. Runtime context             (channel, deploy commit, published_at)
 *   4. Launch-spine sources        (the four canonical primary sources)
 *   5. Supported credential types  (SD-JWT VCTs)
 *   6. Sibling discovery endpoints (well-known + verify + receipt URLs)
 *   7. Operational doctrine        (pointers to the public doc artifacts)
 *   8. Disclaimers                 (explicit non-claims — no fake PSV,
 *                                   no compliance certification)
 */
import type { Metadata } from 'next';
import * as React from 'react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: 'Trust · VitalCV',
  description: 'Institutional trust infrastructure overview.',
};

interface TrustRegisterPayload {
  schema_version: number;
  schema_url: string;
  issuer: { did: string; origin: string };
  signing: {
    active_kid: string;
    algorithm: string;
    jwks_uri: string;
    did_document_uri: string;
  };
  runtime: {
    channel: string;
    deploy_commit: string;
    published_at: string;
  };
  launch_spine: ReadonlyArray<{ id: string; label: string; kind: string }>;
  credentials: ReadonlyArray<{ type: string; vct: string; format: string }>;
  endpoints: Record<string, string>;
  doctrine: Record<string, string>;
  disclaimers: ReadonlyArray<string>;
}

async function loadTrustRegister(): Promise<TrustRegisterPayload> {
  const mod = await import('../.well-known/trust-register/route');
  const res = await mod.GET();
  return (await res.json()) as TrustRegisterPayload;
}

export default async function TrustPage() {
  const manifest = await loadTrustRegister();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-8">
      <header className="space-y-2 border-b border-border pb-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          VitalCV · trust
        </p>
        <h1 className="text-2xl font-semibold leading-tight">Institutional trust infrastructure</h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          Verifier-facing surface for inspecting VitalCV&apos;s issuer identity,
          signing topology, launch-spine sources, supported credentials,
          and operational doctrine. The same data is available
          machine-readable at{' '}
          <Link href="/.well-known/trust-register" className="font-mono underline">
            /.well-known/trust-register
          </Link>{' '}
          (schema v{manifest.schema_version}).
        </p>
      </header>

      <Section label="issuer identity">
        <Row k="did" v={manifest.issuer.did} mono />
        <Row k="origin" v={manifest.issuer.origin} mono />
        <Row k="schema version" v={String(manifest.schema_version)} />
        <Row k="schema url" v={manifest.schema_url} mono />
      </Section>

      <Section label="signing">
        <Row k="active kid" v={manifest.signing.active_kid} mono />
        <Row k="algorithm" v={manifest.signing.algorithm} />
        <Row k="jwks_uri" v={manifest.signing.jwks_uri} mono link={manifest.signing.jwks_uri} />
        <Row
          k="did document"
          v={manifest.signing.did_document_uri}
          mono
          link={manifest.signing.did_document_uri}
        />
      </Section>

      <Section label="runtime">
        <Row k="channel" v={manifest.runtime.channel} mono />
        <Row k="deploy commit" v={manifest.runtime.deploy_commit} mono />
        <Row k="published at" v={manifest.runtime.published_at} mono />
      </Section>

      <Section label="launch-spine sources">
        <ul className="flex flex-col" role="list">
          {manifest.launch_spine.map((s, i) => (
            <li
              key={s.id}
              className="flex items-baseline gap-3 py-1 text-[12px] border-t border-border/40 first:border-t-0"
              data-source-id={s.id}
            >
              <span aria-hidden="true" className="font-mono text-muted-foreground">
                {i === 0 ? '┌' : i === manifest.launch_spine.length - 1 ? '└' : '├'}
              </span>
              <span className="font-mono text-foreground">{s.id}</span>
              <span className="opacity-80">{s.label}</span>
              <span className="font-mono text-[10px] uppercase opacity-60">· {s.kind}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section label="supported credentials">
        <ul className="flex flex-col" role="list">
          {manifest.credentials.map((c) => (
            <li
              key={c.type}
              className="flex items-baseline gap-3 py-1 text-[12px] border-t border-border/40 first:border-t-0"
              data-credential-type={c.type}
            >
              <span className="font-mono">{c.type}</span>
              <span className="font-mono text-[10px] uppercase opacity-60">{c.format}</span>
              <span className="font-mono text-[11px] opacity-80">{c.vct}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section label="discovery endpoints">
        <ul className="flex flex-col" role="list">
          {Object.entries(manifest.endpoints).map(([k, v]) => (
            <li
              key={k}
              className="flex items-baseline gap-3 py-1 text-[12px] border-t border-border/40 first:border-t-0"
            >
              <span className="font-mono text-muted-foreground uppercase tracking-wide text-[10px]">
                {k.replace(/_/g, ' ')}
              </span>
              <Link href={v} className="font-mono hover:underline break-all">
                {v}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section label="operational doctrine">
        <ul className="flex flex-col" role="list">
          {Object.entries(manifest.doctrine).map(([k, v]) => (
            <li
              key={k}
              className="flex items-baseline gap-3 py-1 text-[12px] border-t border-border/40 first:border-t-0"
            >
              <span className="font-mono text-muted-foreground uppercase tracking-wide text-[10px]">
                {k.replace(/_/g, ' ')}
              </span>
              <Link href={v} className="font-mono hover:underline break-all">
                {v}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section label="disclaimers">
        <ul className="flex flex-col gap-2" role="list">
          {manifest.disclaimers.map((d, i) => (
            <li
              key={i}
              className="text-[11px] leading-snug opacity-80 border-l-2 border-border pl-3"
              data-disclaimer-index={i}
            >
              {d}
            </li>
          ))}
        </ul>
      </Section>

      <footer className="border-t border-border pt-3 text-[11px] opacity-70">
        Machine-readable form:{' '}
        <Link href="/.well-known/trust-register" className="font-mono underline">
          /.well-known/trust-register
        </Link>
        {' · '}
        DID document:{' '}
        <Link href="/.well-known/did.json" className="font-mono underline">
          /.well-known/did.json
        </Link>
        {' · '}
        JWKS:{' '}
        <Link href="/.well-known/jwks.json" className="font-mono underline">
          /.well-known/jwks.json
        </Link>
      </footer>
    </main>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2" aria-label={label} data-section={label}>
      <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </h2>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  );
}

function Row({
  k,
  v,
  mono = false,
  link,
}: {
  k: string;
  v: string;
  mono?: boolean;
  link?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px]" data-row-key={k}>
      <span className="font-mono uppercase tracking-wide text-[10px] text-muted-foreground min-w-[7rem]">
        {k}
      </span>
      {link ? (
        <Link href={link} className={mono ? 'font-mono hover:underline break-all' : 'hover:underline'}>
          {v}
        </Link>
      ) : (
        <span className={mono ? 'font-mono break-all' : ''}>{v}</span>
      )}
    </div>
  );
}
