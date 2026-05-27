import { SignUp } from '@clerk/nextjs';
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
import { RoleSegment } from '../../sign-in/RoleSegment';

export const metadata: Metadata = {
  title: 'Get a passport — VitalCV',
  description:
    'Create a VitalCV passport. A reusable view of what public sources say about you today — with a receipt for every read.',
};

/**
 * /sign-up — wraps Clerk's <SignUp /> in the D57 prototype's auth-split shell.
 * See /sign-in for the design rationale on the Clerk + custom shell pairing.
 *
 * chat22 fixes baked in:
 *   #5 (phantom third card) — RoleSegment renders exactly 3 cards, no
 *     empty stub. Roles match the landing role-doors (Clinician / Reviewer
 *     / Operator) — no Operator-only on landing while sign-up showed two.
 */
export default function SignUpPage() {
  return (
    <Shell>
      <Nav
        activePath="/sign-up"
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
            <span className="vs-muted mono vs-small">Already have an account?</span>
            <LinkButton href="/sign-in" variant="primary">
              Sign in
            </LinkButton>
          </>
        }
      />

      <AuthShell
        headline={
          <>
            Three things a passport gives you. <em>Nothing</em> it claims about you.
          </>
        }
        disclosures={[
          {
            glyph: '+',
            label: 'What you get',
            body: (
              <>
                A reusable view of <strong>what public sources say about you today</strong>, with a
                receipt for every read. Carry it across institutions.
              </>
            ),
          },
          {
            glyph: '+',
            label: 'What you control',
            body: (
              <>
                Scope-bound sharing. Send only the fields you choose, to one institution, for a
                window you set. Revoke at any time.
              </>
            ),
          },
          {
            glyph: '+',
            label: 'What it never claims',
            body: (
              <>
                VitalCV is not a credentialing body. A passport does not certify, license, clear,
                or approve anyone to practice — that boundary is the institution&apos;s.
              </>
            ),
          },
          {
            glyph: '·',
            label: 'Accreditation scope',
            body: (
              <>
                VitalCV does not assert HIPAA, SOC 2, or NCQA accreditation. Operational scope is
                published openly.
              </>
            ),
          },
        ]}
      >
        <Eyebrow tag="Get a passport">Free preview · ~3 minutes</Eyebrow>
        <h2 className="vs-h1" style={{ marginTop: 4 }}>
          Start with your NPI.
        </h2>
        <p className="vs-lede" style={{ fontSize: 14.5, marginTop: -6 }}>
          We&apos;ll read NPPES, ABMS and your state board, then show you what&apos;s source-backed
          today.
        </p>

        <Suspense fallback={<div className="vs-skel line-md" aria-hidden />}>
          <RoleSegment />
        </Suspense>

        <BoundaryBanner
          label="By creating a passport you confirm"
          message={
            <>
              You understand VitalCV reads public sources and shows their state.{' '}
              <strong>
                VitalCV does not credential, license, or clear anyone to practice.
              </strong>{' '}
              Final review belongs to the institution.
            </>
          }
          action={<span />}
        />

        {CLERK_PROVIDER_ENABLED ? (
          <Suspense fallback={<div className="vs-skel line-lg" aria-hidden style={{ height: 360 }} />}>
            <SignUp
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
          // Clerk isn't configured in this build. Honest placeholder
          // for preview / staging environments without auth keys.
          <div className="vs-empty" role="status">
            <span className="vs-glyph">i</span>
            <h5>Sign-up is not configured in this build.</h5>
            <p>
              Set <code className="mono">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> +{' '}
              <code className="mono">CLERK_SECRET_KEY</code> and restart to enable account
              creation. Reading a public NPI does not require an account.
            </p>
            <LinkButton href="/" variant="primary">
              Look up a clinician instead
            </LinkButton>
          </div>
        )}

        <div className="vs-auth-ft">
          <span>
            Receipts are signed with ed25519 · <Link href="/trust">read more</Link>
          </span>
          <span>
            <Link href="/contact">Talk to us</Link>
          </span>
        </div>
      </AuthShell>
    </Shell>
  );
}
