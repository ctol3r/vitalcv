import { notFound } from 'next/navigation';

interface PassportSource {
  id: string;
  label: string;
  state: string;
  verifiedAt?: string;
}

interface PassportPayload {
  npi: string;
  name?: string;
  readinessScore?: number;
  sources?: PassportSource[];
  updatedAt?: string;
}

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

async function getPassport(npi: string): Promise<PassportPayload | null> {
  try {
    const res = await fetch(`${BACKEND}/api/passport/${encodeURIComponent(npi)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return res.json() as Promise<PassportPayload>;
  } catch {
    return null;
  }
}

interface Props {
  params: Promise<{ npi: string }>;
}

export default async function VerifyNpiPage({ params }: Props) {
  const { npi } = await params;

  if (!/^\d{10}$/.test(npi)) {
    notFound();
  }

  const passport = await getPassport(npi);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-16">
      <h1 className="text-xl font-semibold tracking-tight text-neutral-950">
        Credential Verification
      </h1>
      <p className="mt-1 text-sm text-neutral-500 font-mono">NPI: {npi}</p>

      {!passport ? (
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-medium text-red-700">No verified passport found for this NPI.</p>
          <p className="mt-1 text-xs text-red-500">
            The clinician may not have completed credentialing, or the NPI is not registered in VitalCV.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {/* Identity */}
          <div className="rounded-lg border border-neutral-200 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">Identity</p>
            <p className="text-lg font-semibold text-neutral-900">{passport.name ?? '—'}</p>
            <p className="text-sm text-neutral-500 font-mono mt-0.5">NPI {passport.npi}</p>
            {passport.updatedAt && (
              <p className="text-xs text-neutral-400 mt-2">
                Last verified: {new Date(passport.updatedAt).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Readiness score */}
          {typeof passport.readinessScore === 'number' && (
            <div className="rounded-lg border border-neutral-200 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Readiness Score</p>
              <p className="text-3xl font-bold text-neutral-900">
                {passport.readinessScore}
                <span className="text-base font-normal text-neutral-400"> / 100</span>
              </p>
            </div>
          )}

          {/* Sources */}
          {Array.isArray(passport.sources) && passport.sources.length > 0 && (
            <div className="rounded-lg border border-neutral-200 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">Verified Sources</p>
              <ul className="space-y-2">
                {passport.sources.map((src) => (
                  <li key={src.id} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-800">{src.label}</span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        src.state === 'verified'
                          ? 'bg-emerald-100 text-emerald-700'
                          : src.state === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-neutral-100 text-neutral-500'
                      }`}
                    >
                      {src.state}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
