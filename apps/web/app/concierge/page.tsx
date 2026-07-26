import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Concierge — Credential Readiness Packet — VitalCV',
  description:
    'A source-backed credential readiness packet, assembled with you and ready to hand to employers and recruiters.',
};

/**
 * /concierge — Wave Q. The first sellable concierge offer, honestly worded:
 * a done-with-you credential readiness packet. This page collects no payment
 * (pricingFoundation keeps collectsPayment: false until real billing exists)
 * and promises no verification outcome — it routes to /contact with the
 * concierge persona preselected.
 */
export default function ConciergePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12" data-testid="concierge-page">
      <header className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
          Concierge service
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-foreground">
          A recruiter-ready credential readiness packet — assembled with you.
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          We sit with you, run your NPI through the source checks VitalCV already performs, and
          assemble your evidence into one shareable, source-backed packet — so the next
          opportunity starts from a head start instead of a blank form.
        </p>
      </header>

      <section aria-labelledby="what-you-get" className="mb-8">
        <h2 id="what-you-get" className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          What the packet contains
        </h2>
        <ul className="mt-3 space-y-3 text-sm text-foreground">
          <li className="rounded-lg border border-border p-3">
            <strong>Readiness snapshot.</strong> Your current credential readiness from live source
            checks, with every item labeled checked, gated, stale, or unknown — never guessed.
          </li>
          <li className="rounded-lg border border-border p-3">
            <strong>Source-coverage summary.</strong> Exactly which primary sources were checked and
            when, so a reviewer can see the provenance of every claim.
          </li>
          <li className="rounded-lg border border-border p-3">
            <strong>Shareable proof link.</strong> A revocable link employers can open to review the
            same evidence — acceptance stays their decision, on their timeline.
          </li>
          <li className="rounded-lg border border-border p-3">
            <strong>Gap list with next steps.</strong> What is still blocking or stale, and the
            concrete step that resolves each item.
          </li>
        </ul>
      </section>

      <section aria-labelledby="honest-scope" className="mb-8">
        <h2 id="honest-scope" className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          What this is — and is not
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          This is a readiness packet, not a credentialing decision. Employers and credentialing
          teams always make their own acceptance decisions; the packet gives them source-backed
          evidence to start from. Items we cannot check against a source are labeled that way
          rather than claimed.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          This is a concierge engagement scoped with you over email — no payment is collected on
          this site today.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/contact?persona=concierge"
          className="inline-flex items-center rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
        >
          Request the concierge packet
        </Link>
        <Link href="/pricing" className="text-sm font-medium text-muted-foreground underline">
          See how VitalCV prices pilots
        </Link>
      </div>
    </main>
  );
}
