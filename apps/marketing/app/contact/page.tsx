import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactForm } from '../../components/contact/ContactForm';

export const metadata: Metadata = {
  title: 'Contact — VitalCV',
  description: 'Get in touch with the VitalCV team — healthcare organizations, investors, or developers.',
  openGraph: {
    title: 'Contact — VitalCV',
    description: 'Get in touch with the VitalCV team — healthcare organizations, investors, or developers.',
    url: 'https://vitalcv.com/contact',
  },
  twitter: {
    title: 'Contact — VitalCV',
    description: 'Get in touch with the VitalCV team.',
  },
};

export default function ContactPage() {
  return (
    <main className="bg-background">
      <section className="mx-auto max-w-[1200px] px-6 pt-20 pb-20 md:pt-28">
        <p className="text-sm uppercase tracking-[0.2em] text-muted">
          Contact
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          Let&apos;s talk.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">
          Whether you&apos;re a healthcare organization interested in verifiable
          credentials, an investor exploring the space, or a developer who wants
          to integrate — we&apos;d love to hear from you.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_auto]">
          {/* Contact form */}
          <div className="rounded-lg border border-border p-6 max-w-lg">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-6">
              Send a message
            </h2>
            <ContactForm />
          </div>

          {/* Right column: email fallback + YC investors */}
          <div className="space-y-4 lg:w-64">
            <div className="rounded-lg border border-border p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Email
              </h2>
              <p className="mt-3 text-sm text-foreground">
                <a
                  href="mailto:hello@vitalcv.com"
                  className="underline underline-offset-4 decoration-border transition-theme hover:decoration-foreground"
                >
                  hello@vitalcv.com
                </a>
              </p>
            </div>

            <div className="rounded-lg border border-border p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                YC investors
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Looking for the live demo or technical docs?
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/demo"
                  className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-theme hover:opacity-90"
                >
                  Try demo
                </Link>
                <Link
                  href="/security"
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-theme hover:bg-surface"
                >
                  Security model
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
