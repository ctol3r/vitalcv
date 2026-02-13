import Link from 'next/link';

/* ---------- Header ---------- */
function Header() {
  return (
    <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-xl font-bold tracking-tight text-foreground">
          VitalCV
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#how-it-works"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            How It Works
          </a>
          <a
            href="#trust"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Trust &amp; Security
          </a>
          <Link
            href="https://app.vitalcv.com"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Sign In
          </Link>
        </nav>
        {/* Mobile menu button */}
        <Link
          href="https://app.vitalcv.com"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity md:hidden"
        >
          Sign In
        </Link>
      </div>
    </header>
  );
}

/* ---------- Hero ---------- */
function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 text-center md:py-32">
      <p className="mb-4 text-sm font-medium uppercase tracking-widest text-primary">
        Verified Trust Infrastructure for Healthcare
      </p>
      <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-6xl">
        Credential Readiness,
        <br />
        <span className="text-primary">Not Credential Chaos</span>
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
        Healthcare doesn&apos;t have a talent shortage — it has a trust throughput
        problem. VitalCV collapses onboarding from months to days with reusable,
        cryptographically verifiable credentials.
      </p>
      <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <Link
          href="https://app.vitalcv.com/signup"
          className="rounded-lg bg-primary px-8 py-3 text-base font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Apply with VitalCV
        </Link>
        <Link
          href="https://app.vitalcv.com/verify"
          className="rounded-lg border border-border px-8 py-3 text-base font-medium text-foreground hover:bg-secondary transition-colors"
        >
          For Verifiers
        </Link>
      </div>
    </section>
  );
}

/* ---------- How It Works ---------- */
const steps = [
  {
    step: '01',
    title: 'Issue',
    description:
      'Licensing boards, health systems, and training programs issue verifiable credentials directly to providers using OpenID4VCI.',
  },
  {
    step: '02',
    title: 'Hold',
    description:
      'Clinicians carry their credentials in a portable digital wallet — always current, always under their control.',
  },
  {
    step: '03',
    title: 'Verify',
    description:
      'Employers and verifiers confirm credential validity in seconds, not weeks. Cryptographic proof replaces phone calls and faxes.',
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-secondary/30 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          How It Works
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          Three roles. One trust loop. Credentials that move at the speed of care.
        </p>
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((item) => (
            <div
              key={item.step}
              className="rounded-xl border border-border bg-background p-8"
            >
              <span className="text-3xl font-bold text-primary/30">
                {item.step}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="mt-3 text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Features ---------- */
const features = [
  {
    title: 'Cryptographic Verification',
    description:
      'Every credential is signed with ES256 elliptic curve cryptography. Tamper-evident, machine-verifiable, and built on W3C Verifiable Credentials.',
  },
  {
    title: 'Instant Issuance',
    description:
      'Issue credentials in seconds using OpenID4VCI. No more paper forms, fax machines, or weeks-long verification cycles.',
  },
  {
    title: 'Portable & Interoperable',
    description:
      "Credentials live in the provider's digital wallet. Present them anywhere, to any verifier, without calling the issuer.",
  },
  {
    title: 'Compliance-Ready',
    description:
      'Built on HAIP 1.0 (High Assurance Interoperability Profile) with DPoP token binding, PKCE, and pushed authorization requests.',
  },
];

function Features() {
  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Why VitalCV
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          Purpose-built for healthcare credentialing. Every design decision
          prioritizes security, speed, and interoperability.
        </p>
        <div className="mt-16 grid gap-8 md:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-border bg-background p-8"
            >
              <h3 className="text-lg font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-3 text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Trust Signals ---------- */
const trustSignals = [
  { label: 'W3C VC 2.0', description: 'Verifiable Credentials standard' },
  { label: 'OpenID4VCI', description: 'Credential issuance protocol' },
  { label: 'OpenID4VP', description: 'Credential presentation protocol' },
  { label: 'HAIP 1.0', description: 'High Assurance Interoperability' },
  { label: 'DPoP (RFC 9449)', description: 'Proof-of-possession tokens' },
  { label: 'ES256', description: 'Elliptic curve digital signatures' },
];

function Trust() {
  return (
    <section id="trust" className="bg-secondary/30 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Built on Open Standards
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          VitalCV implements the latest identity and security standards. No
          proprietary lock-in.
        </p>
        <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3">
          {trustSignals.map((signal) => (
            <div
              key={signal.label}
              className="rounded-lg border border-border bg-background p-5 text-center"
            >
              <p className="text-sm font-semibold text-primary">
                {signal.label}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {signal.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Dual CTA ---------- */
function DualCTA() {
  return (
    <section className="py-24">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-2">
        {/* Clinicians */}
        <div className="rounded-xl border border-border bg-background p-10 text-center">
          <h3 className="text-2xl font-bold text-foreground">
            For Clinicians
          </h3>
          <p className="mt-4 text-muted-foreground">
            Take control of your credentials. Apply once, verify everywhere.
            Your qualifications travel with you.
          </p>
          <Link
            href="https://app.vitalcv.com/signup"
            className="mt-8 inline-block rounded-lg bg-primary px-8 py-3 text-base font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Apply with VitalCV
          </Link>
        </div>
        {/* Verifiers / Employers */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-10 text-center">
          <h3 className="text-2xl font-bold text-foreground">
            For Verifiers &amp; Employers
          </h3>
          <p className="mt-4 text-muted-foreground">
            Collapse onboarding timelines. Verify provider credentials
            cryptographically — in seconds, not months.
          </p>
          <Link
            href="https://app.vitalcv.com/verify"
            className="mt-8 inline-block rounded-lg border border-primary bg-background px-8 py-3 text-base font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            For Verifiers
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */
function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <span className="text-sm font-semibold text-foreground">VitalCV</span>
          <nav className="flex items-center gap-6">
            <Link
              href="https://app.vitalcv.com"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              App
            </Link>
            <a
              href="#how-it-works"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              How It Works
            </a>
            <a
              href="#trust"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Trust
            </a>
          </nav>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} VitalCV. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ---------- Page ---------- */
export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <Trust />
        <DualCTA />
      </main>
      <Footer />
    </>
  );
}
