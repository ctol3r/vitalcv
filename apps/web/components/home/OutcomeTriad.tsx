import * as React from 'react';
import { Fingerprint, Wallet, ClipboardCheck } from 'lucide-react';

/**
 * OutcomeTriad — the Anyscale "outcome-led feature triad": three statements,
 * each pairing a capability with its consequence, in Calm Wave. Chris's copy,
 * kept honest (employer keeps final credentialing authority; no account/upload).
 */
const OUTCOMES = [
  {
    icon: Fingerprint,
    title: 'Start with one identifier',
    body: 'Enter an NPI and VitalCV begins assembling a source-attributed career record — no account, no upload.',
  },
  {
    icon: Wallet,
    title: 'Carry evidence between employers',
    body: 'Reuse the same Wallet and Proof Packet instead of rebuilding your history for every application.',
  },
  {
    icon: ClipboardCheck,
    title: 'Begin review before the offer stalls',
    body: 'Give employers a source-backed head start — while they keep final credentialing authority.',
  },
] as const;

export function OutcomeTriad() {
  return (
    <section aria-label="What changes with VitalCV" data-home-outcome-triad="" className="mz mt-16">
      <p className="mz-eyebrow">What changes</p>
      <h2 className="mz-h1" style={{ marginTop: 14, maxWidth: 640 }}>
        Prove a career <em className="mz-accent">once</em>, then reuse it.
      </h2>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {OUTCOMES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-[12px] border border-[var(--vt-border)] bg-[var(--vt-surface)] px-5 py-6"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[var(--vt-surface-subtle)] text-[var(--vt-text-primary)]">
              <Icon size={18} aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-[16px] font-semibold text-[var(--vt-text-primary)]">{title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--vt-text-secondary)]">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default OutcomeTriad;
