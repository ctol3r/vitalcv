import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie Policy · VitalCV',
  description:
    'VitalCV cookie inventory and consent posture. We describe what cookies are set, who sets them, and why.',
};

const EFFECTIVE_DATE = '2026-05-01';

type CookiePurpose = 'essential' | 'analytics' | 'infrastructure';

interface CookieEntry {
  name: string;
  setBy: string;
  purpose: CookiePurpose;
  duration: string;
  description: string;
}

const PURPOSE_LABEL: Record<CookiePurpose, string> = {
  essential: 'Essential',
  analytics: 'Analytics',
  infrastructure: 'Infrastructure',
};

const PURPOSE_CLASS: Record<CookiePurpose, string> = {
  essential: 'border-emerald-400/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300',
  analytics: 'border-sky-400/40 bg-sky-50 text-sky-800 dark:bg-sky-950/20 dark:text-sky-300',
  infrastructure: 'border-slate-400/40 bg-slate-50 text-slate-700 dark:bg-slate-800/30 dark:text-slate-300',
};

const COOKIES: CookieEntry[] = [
  {
    name: '__session / __client_uat',
    setBy: 'Clerk (Authentication)',
    purpose: 'essential',
    duration: 'Session / 1 year',
    description:
      'Maintains your authenticated session. Required for sign-in, sign-out, and access to protected pages. Cannot be disabled without breaking authentication.',
  },
  {
    name: 'ph_*',
    setBy: 'PostHog (Product Analytics)',
    purpose: 'analytics',
    duration: '1 year',
    description:
      'Set only when PostHog analytics is enabled (controlled by NEXT_PUBLIC_POSTHOG_KEY). Tracks anonymous product usage events (page views, feature interactions) to help us understand how the product is used. Does not collect PHI or NPI data.',
  },
  {
    name: '__vercel_*',
    setBy: 'Vercel (Infrastructure)',
    purpose: 'infrastructure',
    duration: 'Session / short-lived',
    description:
      'Set by the Vercel hosting platform for routing, edge network functions, and deployment infrastructure. Not used by VitalCV for analytics or tracking.',
  },
];

function PurposePill({ purpose }: { purpose: CookiePurpose }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${PURPOSE_CLASS[purpose]}`}
      aria-label={`Cookie purpose: ${PURPOSE_LABEL[purpose]}`}
    >
      {PURPOSE_LABEL[purpose]}
    </span>
  );
}

export default function CookiesPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Legal
        </p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
          Cookie Policy
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Last updated {EFFECTIVE_DATE}.
        </p>
      </header>

      <div className="space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="text-base font-semibold">What are cookies?</h2>
          <p className="mt-2 text-muted-foreground">
            Cookies are small text files placed on your device by a website. VitalCV uses
            cookies to keep you signed in, understand how the product is used, and support
            hosting infrastructure. We do not use advertising cookies or sell data to
            third-party advertisers.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Consent posture</h2>
          <p className="mt-2 text-muted-foreground">
            Essential cookies are required for the service to function and are set on
            sign-in. Analytics cookies (PostHog) are set only when analytics is enabled
            in the deployment configuration. Infrastructure cookies are set by our hosting
            provider (Vercel) as a necessary part of serving the application.
          </p>
          <p className="mt-2 text-muted-foreground">
            VitalCV does not currently serve a cookie-consent banner for essential or
            infrastructure cookies, as these are necessary to provide the service. If you
            have a consent or GDPR inquiry, contact{' '}
            <a href="mailto:privacy@vitalcv.com" className="underline hover:text-foreground">
              privacy@vitalcv.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-base font-semibold">Cookie inventory</h2>
          <div className="divide-y divide-border rounded-lg border">
            {COOKIES.map((cookie) => (
              <div key={cookie.name} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-semibold text-foreground">
                      {cookie.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Set by {cookie.setBy} · Duration: {cookie.duration}
                    </p>
                  </div>
                  <PurposePill purpose={cookie.purpose} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{cookie.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold">Changes to this policy</h2>
          <p className="mt-2 text-muted-foreground">
            We may update this cookie inventory when we add or remove cookies. The effective
            date at the top of this page will reflect the most recent update.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Contact</h2>
          <p className="mt-2 text-muted-foreground">
            Cookie or privacy questions:{' '}
            <a href="mailto:privacy@vitalcv.com" className="underline hover:text-foreground">
              privacy@vitalcv.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
