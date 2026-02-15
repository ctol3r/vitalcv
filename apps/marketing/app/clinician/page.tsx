import Link from 'next/link';

/**
 * Clinician page — displays NPI and placeholder credential profile.
 *
 * Next.js 15: searchParams is a Promise in server components.
 * We await it to extract the `npi` query parameter.
 */
export default async function ClinicianPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const npi = typeof params.npi === 'string' ? params.npi : null;

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-24 md:py-32">
      <Link
        href="/"
        className="text-sm text-muted transition-theme hover:text-foreground"
      >
        &larr; Back
      </Link>

      <h1 className="mt-8 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
        Clinician Portal
      </h1>

      {npi ? (
        <div className="mt-8">
          <p className="text-lg text-foreground">
            <span className="text-muted">NPI:</span>{' '}
            <span className="font-mono font-semibold tabular-nums">{npi}</span>
          </p>
          <div className="mt-6 rounded-lg border border-border p-6">
            <p className="text-sm text-muted">
              Credential profile loading&hellip;
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-4 max-w-lg text-lg text-muted">
          Your portable credential profile. Coming soon.
        </p>
      )}
    </main>
  );
}
