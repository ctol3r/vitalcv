import * as React from 'react';

/**
 * Cal.com / Calendly booking embed.
 *
 * Behavior:
 *   - When NEXT_PUBLIC_CALENDLY_URL is unset, returns null. The page
 *     falls through to the per-plan /contact CTAs.
 *   - When set, renders a sandboxed iframe pointing at the URL. We
 *     intentionally don't load Calendly's or Cal.com's JS widget
 *     (which would inject third-party scripts into the marketing
 *     bundle); the iframe is enough for booking and stays inside
 *     our CSP.
 *   - Only `https://` URLs from cal.com or calendly.com hostnames
 *     are accepted. Any other value renders the same null fallback,
 *     so a misconfigured env can't smuggle a third-party iframe in.
 */

const ALLOWED_HOSTS: ReadonlyArray<RegExp> = [
  /^([a-z0-9-]+\.)?cal\.com$/i,
  /^([a-z0-9-]+\.)?calendly\.com$/i,
];

export function isAllowedBookingUrl(url: string | undefined): url is string {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  return ALLOWED_HOSTS.some((re) => re.test(parsed.hostname));
}

export function CalendarBookingEmbed() {
  // Single source of truth: the env var. There is no prop override.
  // Tests stub `process.env.NEXT_PUBLIC_CALENDLY_URL` directly so
  // there is exactly one render path — both for tests and prod —
  // gated by isAllowedBookingUrl.
  const resolved = process.env.NEXT_PUBLIC_CALENDLY_URL;
  if (!isAllowedBookingUrl(resolved)) {
    return null;
  }

  return (
    <section
      aria-labelledby="booking-heading"
      className="mt-8 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      data-testid="calendar-booking-embed"
      data-booking-host={new URL(resolved).hostname}
    >
      <h2 id="booking-heading" className="text-base font-semibold sm:text-lg">
        Or book a 20-minute call
      </h2>
      <p className="mt-2 text-xs text-muted-foreground">
        For pilot scoping conversations. Booking does not create a paid
        subscription.
      </p>
      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        <iframe
          src={resolved}
          title="Book a pilot scoping call"
          className="h-[640px] w-full"
          // Explicit allow list — keep this minimal; the embed only
          // needs basic scheduling primitives.
          allow="camera; microphone; clipboard-write"
          // Don't grant top-level navigation to a third party.
          sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
          loading="lazy"
        />
      </div>
    </section>
  );
}
