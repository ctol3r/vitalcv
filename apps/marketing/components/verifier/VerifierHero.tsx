import Link from 'next/link';

export function VerifierHero() {
  return (
    <section className="mx-auto max-w-[1200px] px-6 pb-24 pt-20 md:pb-32 md:pt-28">
      <Link
        href="/"
        className="text-sm text-muted transition-theme hover:text-foreground"
      >
        &larr; Home
      </Link>

      <h1 className="mt-8 text-5xl font-semibold tracking-tight text-foreground md:text-6xl">
        Verification infrastructure
        <br />
        for credentialing teams.
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-muted">
        Replace manual PSV with cryptographic proof. Verify clinician
        credentials in seconds, not weeks. Every verification produces a
        tamper-evident, audit-ready artifact.
      </p>
    </section>
  );
}
