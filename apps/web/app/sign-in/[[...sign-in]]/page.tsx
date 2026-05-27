import { SignIn } from '@clerk/nextjs';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  AuthShell,
  BoundaryBanner,
  Eyebrow,
  LinkButton,
  Nav,
  Shell,
} from '@/components/visual';
import { CLERK_PROVIDER_ENABLED } from '@/lib/auth/clerkConfig';
import { RoleSegment } from '../RoleSegment';

export const metadata: Metadata = {
  title: 'Sign in — VitalCV',
  description:
    'Sign in to add self-reported facts, share scope-bound packets, and see receipts. Public passport pages remain readable without an account.',
};

/**
 * /sign-in — wraps Clerk's <SignIn /> in the D57 prototype's auth-split shell.
 *
 * The prototype designed a custom passwordless form (email + OTP), but
 * production auth is owned by Clerk. We keep Clerk for actual sign-in
 * (so SSO, MFA, and session management work) and use the prototype's
 * shell for the visual surround + the role segmented control.
 *
 * chat22 fixes baked in:
 *   #6 (tab clipping) — RoleSegment uses min-height 64px + 14/12 padding.
 *   #13 (loading + auth-required + code-sent states) — Clerk's component
 *     handles all three states out of the box; the BoundaryBanner makes
 *     the review-boundary explicit so users understand sign-in does NOT
 *     credential them.
 */
export default function SignInPage() {
  return (
    <Shell>
      <Nav
        activePath="/sign-in"
        showCmdPill={false}
        links={[
          { href: '/', label: 'Overview' },
          { href: '/trust', label: 'Trust' },
          { href: '/trust/attribution', label: 'Attribution' },
          { href: '/status', label: 'Status' },
        ]}
        status={null}
        cta={
          <>
            <span className="vs-muted mono vs-small">Don&apos;t have an account?</span>
            <LinkButton href="/sign-up" variant="primary">
              Get a passport
            </LinkButton>
          </>
        }
      />

      <AuthShell
        headline={
          <>
            Sign in to read what is <em>source-backed</em> about you — and to share it.
          </>
        }
        disclosures={[
          {
            label: 'Why sign-in matters',
            body: (
              <>
                Reading a public NPI doesn&apos;t require an account.{' '}
                <strong>
                  Sign in is for adding self-reported facts, sharing scope-bound packets with an
                  institution, and seeing the receipts of every read.
                </strong>
              </>
            ),
          },
          {
            label: 'What sign-in is not',
            body: (
              <>
                VitalCV does not credential, license, or clear a clinician to practice.
                Institutions retain full authority over hiring and privileging.
              </>
            ),
          },
          {
            label: 'How we authenticate',
            body: (
              <>
                Passwordless, by default — a one-time code to work email or phone. Hospital SSO
                when your institution provides it.
              </>
            ),
          },
        ]}
      >
        <Eyebrow tag="Sign in">Choose how you&apos;re using VitalCV</Eyebrow>
        <h2 className="vs-h1" style={{ marginTop: 4 }}>
          Continue to VitalCV.
        </h2>
        <p
          className="vs-lede"
          style={{ fontSize: 14.5, marginTop: -6 }}
        >
          Passwordless by default. We never ask for a long-lived password.
        </p>

        <Suspense fallback={<div className="vs-skel line-md" aria-hidden />}>
          <RoleSegment />
        </Suspense>

        {CLERK_PROVIDER_ENABLED ? (
          <Suspense fallback={<div className="vs-skel line-lg" aria-hidden style={{ height: 280 }} />}>
            <SignIn
              appearance={{
                variables: {
                  colorPrimary: 'oklch(38% 0.14 274)',
                  colorBackground: 'oklch(98.5% 0.004 85)',
                  colorInputBackground: 'oklch(98.5% 0.004 85)',
                  colorText: 'oklch(18% 0.012 265)',
                  colorTextSecondary: 'oklch(46% 0.010 265)',
                  borderRadius: '6px',
                  fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif",
                  fontFamilyButtons: "'Geist', ui-sans-serif, system-ui, sans-serif",
                },
                elements: {
                  rootBox: 'vs-clerk-root',
                  card: 'vs-clerk-card',
                },
              }}
            />
          </Suspense>
        ) : (
          // Clerk isn't configured in this build. Render an honest placeholder
          // so the shell still demonstrates correctly in preview / staging
          // environments without auth keys.
          <div className="vs-empty" role="status">
            <span className="vs-glyph">i</span>
            <h5>Sign-in is not configured in this build.</h5>
            <p>
              Set <code className="mono">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> +{' '}
              <code className="mono">CLERK_SECRET_KEY</code> and restart to enable Clerk
              passwordless sign-in here. Public passport pages remain readable without an account.
            </p>
            <LinkButton href="/" variant="primary">
              Look up a clinician instead
            </LinkButton>
          </div>
        )}

        <BoundaryBanner
          label="Review boundary"
          message={
            <>
              Signing in does not approve, clear, or credential anyone. VitalCV reads public
              sources and shows their state. <strong>Institutions retain full authority.</strong>
            </>
          }
          action={<span />}
          style={{ marginTop: 8 }}
        />

        <div className="vs-auth-ft">
          <span>v2.4.0 · D57</span>
          <span>
            <Link href="/trust">How we read sources</Link> · <Link href="/contact">Talk to us</Link>
          </span>
        </div>
      </AuthShell>
    </Shell>
  );
}
