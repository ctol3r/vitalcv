import type { Metadata } from 'next';
import { Suspense } from 'react';
import {
  Card,
  CardBody,
  Eyebrow,
  Footer,
  LinkButton,
  Nav,
  Shell,
  TruthChip,
} from '@/components/visual';
import { PilotIntakeForm } from './PilotIntakeForm';

export const metadata: Metadata = {
  title: 'Contact — VitalCV',
  description:
    'Talk to us. We answer specifically. VitalCV works with one credentialing team at a time.',
};

/**
 * /contact — ported from D57 vitalcv-app/contact.html.
 *
 * Preserved:
 *   - PilotIntakeForm — the real submission handler (server route)
 *   - `data-testid="contact-page"` for any tests asserting the page.
 *
 * The prototype's 4-card "four conversations" grid sits on top; the
 * existing PilotIntakeForm slots into the prototype's "Send us a single
 * thread" card body, so the working form keeps shipping behind a new shell.
 */
export default function ContactPage() {
  return (
    <Shell>
      <Nav
        cta={
          <>
            <LinkButton href="/sign-in">Sign in</LinkButton>
            <LinkButton href="/sign-up" variant="primary">
              Get a passport
            </LinkButton>
          </>
        }
      />

      <main className="vs-page narrow" data-testid="contact-page">
        <section style={{ padding: '40px 0 24px' }}>
          <Eyebrow tag="Contact">One thread per question · we reply within 1 business day</Eyebrow>
          <h1 className="vs-h-display" style={{ fontSize: 44, marginTop: 18 }}>
            Talk to us. We answer specifically.
          </h1>
          <p className="vs-lede" style={{ marginTop: 14 }}>
            VitalCV is in preview with a small group of institutions. Tell us which of the four
            conversations you want.
          </p>
        </section>

        <section className="vs-grid-2">
          <Card>
            <CardBody>
              <span className="vs-micro">For institutions</span>
              <h3 className="vs-h2" style={{ marginTop: 10 }}>
                Pilot a reusable read
              </h3>
              <p className="vs-muted vs-small" style={{ marginTop: 10, lineHeight: 1.6 }}>
                We work with one credentialing team at a time. Show us your sources, your review
                checklist, and what you&apos;d want a passport to look like.
              </p>
              <LinkButton
                href="mailto:pilots@vitalcv.com"
                variant="primary"
                style={{ marginTop: 14 }}
              >
                pilots@vitalcv.com
              </LinkButton>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <span className="vs-micro">For clinicians</span>
              <h3 className="vs-h2" style={{ marginTop: 10 }}>
                Read your own passport
              </h3>
              <p className="vs-muted vs-small" style={{ marginTop: 10, lineHeight: 1.6 }}>
                Start with your NPI. If you want help adding self-reported fields or producing a
                scope-bound packet for an institution, write us.
              </p>
              <LinkButton href="/sign-up" variant="primary" style={{ marginTop: 14 }}>
                Get a passport
              </LinkButton>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <span className="vs-micro">For source operators</span>
              <h3 className="vs-h2" style={{ marginTop: 10 }}>
                Add or correct a registry
              </h3>
              <p className="vs-muted vs-small" style={{ marginTop: 10, lineHeight: 1.6 }}>
                Run a state board or registry we should read? Or seeing VitalCV represent your
                data inaccurately? Send us the URL and we&apos;ll respond by 1 business day with a
                fix or a reasoned no.
              </p>
              <LinkButton href="mailto:registries@vitalcv.com" style={{ marginTop: 14 }}>
                registries@vitalcv.com
              </LinkButton>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <span className="vs-micro">For security &amp; trust questions</span>
              <h3 className="vs-h2" style={{ marginTop: 10 }}>
                Operational scope &amp; receipts
              </h3>
              <p className="vs-muted vs-small" style={{ marginTop: 10, lineHeight: 1.6 }}>
                Auditors, security reviewers, or counsel — we publish operational scope on{' '}
                <a
                  href="/status"
                  style={{
                    color: 'var(--vs-accent-ink)',
                    textDecoration: 'underline',
                    textDecorationColor: 'var(--vs-accent)',
                  }}
                >
                  /status
                </a>
                . For anything specific, email security and we&apos;ll cite the documents we have.
              </p>
              <LinkButton href="mailto:security@vitalcv.com" style={{ marginTop: 14 }}>
                security@vitalcv.com
              </LinkButton>
            </CardBody>
          </Card>
        </section>

        <Card style={{ marginTop: 18 }}>
          <CardBody>
            <div
              className="vs-row vs-between"
              style={{ marginBottom: 14 }}
            >
              <div>
                <span className="vs-micro">A quick message</span>
                <h3 className="vs-h2" style={{ marginTop: 6 }}>
                  Send us a single thread
                </h3>
              </div>
              <TruthChip
                state="source-backed"
                source="8 business hours"
                label="Avg reply"
              />
            </div>
            <Suspense fallback={null}>
              <PilotIntakeForm />
            </Suspense>
            <p className="vs-micro vs-muted" style={{ marginTop: 16 }}>
              We never share your message · we don&apos;t credential anyone.
            </p>
          </CardBody>
        </Card>
      </main>

      <Footer
        receipt="VS-D57-contact · ed25519"
        lastRead="Contact · 1 business day reply target"
      />
    </Shell>
  );
}
