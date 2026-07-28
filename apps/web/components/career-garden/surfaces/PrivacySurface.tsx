import Link from 'next/link';

import { DEMO_ROOTS, GARDEN_PRIVACY_LINE } from '@/lib/career-garden/demoData';
import { GARDEN_HREF_FOR, type GardenMount } from '@/lib/career-garden/nav';

import { GardenStamp } from '../GardenStamp';

/**
 * Privacy & Connections — trust rendered legibly, not claimed. Four kinds
 * of standing are kept visually and verbally distinct, every connection
 * states what was observed and when, and the page says plainly what this
 * prototype does not do. No certification or security-control claims.
 */
export function PrivacySurface({ mount }: { mount: GardenMount }) {
  const hrefFor = GARDEN_HREF_FOR[mount];
  return (
    <div className="space-y-10">
      <header>
        <h2 className="mz-h2">Privacy & connections</h2>
        <p className="mz-body mt-2" style={{ color: 'var(--ink-600)' }}>
          {GARDEN_PRIVACY_LINE} Promoting a note to your CV is explicit. Selecting evidence for a packet is
          explicit. Nothing moves between layers on its own.
        </p>
        <p className="mz-small mt-2" style={{ color: 'var(--vt-text-muted)' }}>
          This prototype makes no security, compliance, or encryption claims — what you see is a visibility
          model, and it holds only fictional sample data.
        </p>
      </header>

      <section aria-labelledby="privacy-legend">
        <h3 id="privacy-legend" className="mz-eyebrow">
          Four kinds of standing — never blurred
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="mz-card p-4">
            <GardenStamp provenance="connected-profile" />
            <p className="mz-small mt-2">
              You authenticated with the provider. VitalCV reads only what the connection scope allows and shows
              you exactly what it observed.
            </p>
          </div>
          <div className="mz-card p-4">
            <GardenStamp provenance="self-added-link" />
            <p className="mz-small mt-2">
              A URL you saved. Nothing is imported, read, or inferred from it — it is a pointer, not a source.
            </p>
          </div>
          <div className="mz-card p-4">
            <p className="mz-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: 'var(--ink-600)' }}>
              Source-backed evidence
            </p>
            <p className="mz-small mt-2">
              A named source returned a value, with the observation time attached. None exists in this prototype
              — no lookup runs here, so nothing on these pages claims it.
            </p>
          </div>
          <div className="mz-card p-4">
            <GardenStamp provenance="ai-assisted-draft" />
            <p className="mz-small mt-2">
              Wording proposed for your review, always labeled, never sent anywhere, and never a claim about
              facts. Drafts become CV lines only when you approve them.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="privacy-connections">
        <h3 id="privacy-connections" className="mz-eyebrow">
          Your connections (sample)
        </h3>
        <ul className="mt-3 space-y-3">
          {DEMO_ROOTS.map((root) => (
            <li key={root.id} className="mz-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="mz-body font-medium" style={{ color: 'var(--ink-900)' }}>
                    {root.provider}
                  </p>
                  <p className="mz-mono mt-0.5 text-[11px]" style={{ color: 'var(--ink-500)' }}>
                    {root.externalRef}
                  </p>
                </div>
                <GardenStamp provenance={root.state} />
              </div>
              <dl className="mt-3 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
                <div>
                  <dt className="mz-small mz-mono uppercase tracking-[0.1em]" style={{ color: 'var(--ink-500)' }}>
                    Connection method
                  </dt>
                  <dd className="mz-small mt-0.5">{root.method}</dd>
                </div>
                <div>
                  <dt className="mz-small mz-mono uppercase tracking-[0.1em]" style={{ color: 'var(--ink-500)' }}>
                    What VitalCV observed
                  </dt>
                  <dd className="mz-small mt-0.5">
                    {root.observed}
                    {root.observedAt ? (
                      <span className="mz-mono" style={{ color: 'var(--ink-500)' }}>
                        {' '}
                        · {root.observedAt}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="mz-small mz-mono uppercase tracking-[0.1em]" style={{ color: 'var(--ink-500)' }}>
                    Refresh
                  </dt>
                  <dd className="mz-small mt-0.5">{root.refresh}</dd>
                </div>
                <div>
                  <dt className="mz-small mz-mono uppercase tracking-[0.1em]" style={{ color: 'var(--ink-500)' }}>
                    Sharing
                  </dt>
                  <dd className="mz-small mt-0.5">{root.sharing}</dd>
                </div>
              </dl>
              <p className="mz-small mt-3 border-t border-[var(--rule-soft)] pt-2" style={{ color: 'var(--vt-text-muted)' }}>
                Revocable at any time — disconnecting removes what the connection contributed.
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="privacy-sharing" className="mz-card p-5">
        <h3 id="privacy-sharing" className="mz-card-ttl">
          When you do share
        </h3>
        <p className="mz-body mt-2">
          Sharing stays off in this prototype. In the product, a share is an explicit packet, and its record
          always shows:
        </p>
        <ul className="mz-mono mt-3 grid gap-1.5 text-[12px] sm:grid-cols-2" style={{ color: 'var(--ink-600)' }}>
          <li>· who received it</li>
          <li>· the purpose you chose</li>
          <li>· the moment you consented</li>
          <li>· the packet version</li>
          <li>· every field it contained</li>
          <li>· its full sharing history</li>
        </ul>
        <p className="mz-small mt-3" style={{ color: 'var(--vt-text-muted)' }}>
          Your live application record already lives under{' '}
          <Link href="/holder/applications" className="underline underline-offset-4">
            Updates
          </Link>
          ; sealed packets will join this page in a later wave.
        </p>
      </section>

      <p className="mz-small" style={{ color: 'var(--vt-text-muted)' }}>
        Questions about what is visible where? Start from the{' '}
        <Link href={hrefFor('home')} className="underline underline-offset-4">
          garden home
        </Link>{' '}
        — every surface answers it in place.
      </p>
    </div>
  );
}
