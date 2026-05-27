'use client';

import { SignedIn } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import {
  BoundaryBanner,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CmdPill,
  Door,
  Doors,
  Eyebrow,
  FieldGroup,
  FieldHint,
  Footer,
  Input,
  LinkButton,
  Nav,
  Section,
  Shell,
  TruthChip,
} from '@/components/visual';
import { CLERK_PROVIDER_ENABLED } from '@/lib/auth/clerkConfig';

/**
 * Homepage — ported from the D57 vitalcv-app/index.html prototype.
 *
 * Preserves the NPI handoff (sessionStorage + localStorage + router.push)
 * from the previous HomePageClient. Everything visual is replaced by the
 * paper-substrate / hairline / one-accent design system in `.vs-root`.
 *
 * chat22 fixes baked in:
 *   #1 (TruthChip compound form) — all 8 legend chips use <TruthChip> with
 *      both a state AND a source segment, including "Sources disagree" and
 *      "Not asserted" which the prototype rendered bare.
 *   #8 (distinct role-door destinations) — Clinician → /passport (clinician),
 *      Reviewer → /sign-in?role=reviewer, Operator → /status.
 *   #9 (global ⌘K) — CmdPill is in the Nav, not only on the passport.
 */
export default function HomePageClient() {
  const router = useRouter();
  const [raw, setRaw] = React.useState('1699264564');
  const [error, setError] = React.useState<string | null>(null);

  const digits = raw.replace(/\D/g, '').slice(0, 10);
  const isFull = digits.length === 10;

  const handleSubmit = React.useCallback(() => {
    if (!isFull) {
      setError('Enter a full 10-digit NPI.');
      return;
    }
    setError(null);
    try {
      window.sessionStorage.setItem('onboarding_npi', digits);
      window.localStorage.setItem('onboarding_npi', digits);
    } catch {
      // Keep the handoff continuous when storage is unavailable.
    }
    router.push(`/passport?npi=${digits}`);
  }, [digits, isFull, router]);

  return (
    <Shell>
      <Nav
        activePath="/"
        cta={
          <>
            <LinkButton href="/sign-in">Sign in</LinkButton>
            <LinkButton href="/sign-up" variant="primary">
              Get a passport
            </LinkButton>
          </>
        }
      />

      {CLERK_PROVIDER_ENABLED && (
        <SignedIn>
          <div
            style={{
              borderBottom: '1px solid var(--vs-hairline)',
              background: 'var(--vs-accent-wash)',
              padding: '10px 14px',
              textAlign: 'center',
              fontFamily: 'var(--vs-mono)',
              fontSize: 11.5,
              color: 'var(--vs-accent-ink)',
              letterSpacing: '0.04em',
            }}
          >
            Signed in ·{' '}
            <Link
              href="/holder"
              style={{ textDecoration: 'underline', textUnderlineOffset: 2 }}
            >
              Go to workspace →
            </Link>
          </div>
        </SignedIn>
      )}

      <main className="vs-page">
        <section className="vs-hero">
          <div className="vs-hero-grid">
            <div className="vs-hero-meta">
              <Eyebrow tag="VitalCV · D57">Reusable · source-backed · institution-reviewed</Eyebrow>
              <h1 className="vs-h-display">
                Look up a clinician by NPI. Read what is <em>source-backed</em>, what is pending,
                what an institution still has to review.
              </h1>
              <p className="vs-lede">
                VitalCV is a reusable readiness layer for healthcare credentialing. Every field
                cites its source and the time it was last read. Nothing on this page implies final
                credentialing — that boundary belongs to the institution.
              </p>

              <div className="vs-proofs">
                <div>
                  <span className="vs-k">Fields read</span>
                  <span className="vs-v">
                    28 <small>of 32 possible</small>
                  </span>
                </div>
                <div>
                  <span className="vs-k">Public sources</span>
                  <span className="vs-v">
                    3 responding <small>1 unavailable · NPDB</small>
                  </span>
                </div>
                <div>
                  <span className="vs-k">Self-reported</span>
                  <span className="vs-v">
                    4 fields <small>not yet source-backed</small>
                  </span>
                </div>
                <div>
                  <span className="vs-k">Review boundary</span>
                  <span className="vs-v">
                    Institution <small>VitalCV does not credential</small>
                  </span>
                </div>
              </div>

              <div className="vs-row" style={{ marginTop: 20 }}>
                <CmdPill />
                <LinkButton href="/trust" variant="ghost">
                  How VitalCV reads sources →
                </LinkButton>
              </div>
            </div>

            <aside className="vs-npi-card">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSubmit();
                }}
              >
                <FieldGroup>
                  <label htmlFor="home-npi">NPI · 10-digit identifier</label>
                  <div className="vs-npi-input-row">
                    <Input
                      id="home-npi"
                      mono
                      size="lg"
                      value={raw}
                      onChange={(event) => {
                        setRaw(event.target.value);
                        setError(null);
                      }}
                      placeholder="1699264564"
                      maxLength={10}
                      inputMode="numeric"
                      autoFocus
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? 'home-npi-error' : undefined}
                    />
                    <button type="submit" className="vs-btn accent lg">
                      Read passport
                    </button>
                  </div>
                  <FieldHint>
                    <span id={error ? 'home-npi-error' : undefined}>
                      {error ?? 'NPI is public on the NPPES registry.'}
                    </span>
                    <Link href="/trust/attribution">What we read</Link>
                  </FieldHint>
                </FieldGroup>
              </form>

              <div className="vs-hint-list">
                <span>NPPES — name, taxonomy, practice address</span>
                <span>ABMS — board certification, recert window</span>
                <span>State boards — license + expiration</span>
                <span>OIG LEIE / SAM.gov — sanction record</span>
              </div>

              <div className="vs-disclaimer">
                VitalCV is not a credentialing body. We read public sources, show what is
                source-backed and what is not, and surface what an institution must review on its
                own.
              </div>
            </aside>
          </div>
        </section>

        <Section num="01" title="Three ways to read a passport" aside="Same data · different defaults">
          <Doors>
            {/* chat22 fix #8: each door has a DISTINCT destination */}
            <Door
              href={`/passport?npi=${isFull ? digits : '1699264564'}`}
              role="For clinicians"
              name="Read your own passport"
              glyph="C"
              desc="See what is source-backed about you today. Add what's missing. Export a receipt to share with an institution."
              uses={[
                'Onboarding at a new institution',
                'Recert & renewal preparation',
                'Sharing scope-bound evidence',
              ]}
              cta="Enter your NPI"
            />
            <Door
              href="/sign-in?role=reviewer"
              role="For institutions"
              name="Read a clinician for review"
              glyph="I"
              desc="Sign in as a reviewer to read a clinician's passport with verifier context — what is source-backed, what your team still has to review."
              uses={[
                'Pre-onboarding read',
                'Reconcile contradicting sources',
                'Build an evidence packet',
              ]}
              cta="Sign in as reviewer"
            />
            <Door
              href="/status"
              role="For operators"
              name="Watch connector health"
              glyph="O"
              desc="Source reachability and last-read times for every public registry VitalCV consults. Degraded states are explained by the source, not the clinician."
              uses={[
                'Connector matrix · 4 sources',
                'Last-read freshness · per source',
                'Replay any read',
              ]}
              cta="View status"
            />
          </Doors>
        </Section>

        <Section
          num="02"
          title="What a passport actually contains"
          aside={`Live preview · NPI ${isFull ? digits : '1699264564'}`}
        >
          <Card>
            <CardHeader title="Passport · sample" aside="Read 09:14 UTC · 3 of 4 sources responding" />
            <CardBody>
              <div className="vs-field">
                <span className="vs-label">Legal name</span>
                <span className="vs-value">
                  Asha N. Bhatt, MD
                  <small className="vs-source">NPPES · read 09:14 UTC · agreed by ABMS</small>
                </span>
                <span className="vs-meta">
                  <TruthChip state="source-backed" source="NPPES + ABMS · 14m" />
                </span>
              </div>
              <div className="vs-field">
                <span className="vs-label">Board certification</span>
                <span className="vs-value">
                  Internal Medicine
                  <small className="vs-source">
                    ABMS · read 2026·05·12 · recert window 2028·12·31
                  </small>
                </span>
                <span className="vs-meta">
                  <TruthChip state="source-backed" source="ABMS · 14d" />
                </span>
              </div>
              <div className="vs-field">
                <span className="vs-label">State license · CA</span>
                <span className="vs-value mono-val">
                  A‑88142
                  <small className="vs-source">
                    CA Medical Board · last read 2026·05·14 · expires 2027·03·31
                  </small>
                </span>
                <span className="vs-meta">
                  <TruthChip state="source-backed" source="CA Med Board · 12d" />
                </span>
              </div>
              <div className="vs-field">
                <span className="vs-label">Sanction record</span>
                <span className="vs-value">
                  No sanction found in OIG LEIE
                  <small className="vs-source">
                    OIG LEIE · read 2026·05·26 · SAM.gov · unavailable
                  </small>
                </span>
                <span className="vs-meta">
                  <TruthChip state="pending-source" source="1 of 2 · SAM offline" label="Partial read" />
                </span>
              </div>
              <div className="vs-field">
                <span className="vs-label">Malpractice history</span>
                <span className="vs-value">
                  Not asserted in any public source we read.
                  <small className="vs-source">
                    NPDB requires institution access — VitalCV cannot read this on your behalf.
                  </small>
                </span>
                <span className="vs-meta">
                  <TruthChip state="review-needed" source="NPDB · institution-only" />
                </span>
              </div>
              <div className="vs-field">
                <span className="vs-label">Hospital privileges</span>
                <span className="vs-value">
                  Self-reported: UCSF Medical Center, active
                  <small className="vs-source">
                    Clinician self-report · 2026·04·22 · not yet source-backed
                  </small>
                </span>
                <span className="vs-meta">
                  <TruthChip state="self-reported" source="awaiting MSO attestation" />
                </span>
              </div>
            </CardBody>
            <CardFooter>
              <span>↳ 22 more fields in the passport · open to read</span>
              <span style={{ flex: 1 }} />
              <Link
                href={`/passport?npi=${isFull ? digits : '1699264564'}`}
                style={{
                  color: 'var(--vs-accent-ink)',
                  fontFamily: 'var(--vs-sans)',
                  fontWeight: 500,
                  fontSize: 13,
                }}
              >
                Open full passport →
              </Link>
            </CardFooter>
          </Card>

          <BoundaryBanner
            label="Review boundary"
            message={
              <>
                VitalCV reads public registries and shows their state.{' '}
                <strong>Final credentialing is the institution&apos;s decision</strong> — VitalCV
                never marks a clinician cleared, approved, or eligible to practice.
              </>
            }
            action={<LinkButton href="/trust">Read trust model</LinkButton>}
            style={{ marginTop: 18 }}
          />
        </Section>

        <Section num="03" title="The states VitalCV uses" aside="Eight · paired with source &amp; time">
          <p className="vs-lede" style={{ marginBottom: 24 }}>
            Every field in VitalCV resolves to one of eight states. Each pairs an ink color with a
            source name and a timestamp — never a bare word, never a score.
          </p>

          <div className="vs-grid-4">
            {/* chat22 fix #1: all 8 chips use compound .truth form — including
                "Sources disagree" and "Not asserted" which were bare in the prototype. */}
            <LegendCard
              chip={<TruthChip state="source-backed" source="ABMS · 14d" />}
              desc="Two or more public sources agree within freshness window."
            />
            <LegendCard
              chip={<TruthChip state="pending-source" source="CA Board · retry 02:14" />}
              desc="Source queued for read or temporarily unreachable."
            />
            <LegendCard
              chip={<TruthChip state="source-unavailable" source="SAM.gov · offline 02h" />}
              desc="A source we usually consult is offline. Not the clinician's failure."
            />
            <LegendCard
              chip={<TruthChip state="self-reported" source="clinician · 2026·04·22" />}
              desc="Stated by the clinician — not yet backed by an external source."
            />
            <LegendCard
              chip={<TruthChip state="review-needed" source="NPDB · institution-only" />}
              desc="Source is institution-gated. Outside VitalCV's read scope."
            />
            <LegendCard
              chip={<TruthChip state="sanction" source="OIG LEIE · 2026·05·26" />}
              desc="Public sanction record exists. Surfaced literally, never softened."
            />
            <LegendCard
              chip={<TruthChip state="contradicted" source="NPPES vs. MSO self-report" />}
              desc="Two sources return different values. Reconcile, never auto-merge."
            />
            <LegendCard
              chip={<TruthChip state="not-asserted" source="no source asked yet" />}
              desc="No source has been asked yet. Gray, not red. Suggests next read."
            />
          </div>
        </Section>
      </main>

      <Footer />
    </Shell>
  );
}

function LegendCard({ chip, desc }: { chip: React.ReactNode; desc: string }) {
  return (
    <Card>
      <CardBody tight>
        {chip}
        <p className="vs-small vs-muted" style={{ margin: '10px 0 0', lineHeight: 1.5 }}>
          {desc}
        </p>
      </CardBody>
    </Card>
  );
}
