import Link from 'next/link';

type PilotOrg = {
  id: string;
  name: string;
  contactEmail: string;
  activatedAt: string;
  accepted: boolean;
  bundlesGenerated: number;
};

type PilotReport = {
  pilotOrgs: PilotOrg[];
  pilotOrgCount: number;
  isDemoMode?: boolean;
};

const DEFAULT_BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE || '';

function normalizeOrganizationId(
  value?: string | string[] | undefined,
): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first !== 'string') {
      return undefined;
    }
    const trimmed = first.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return undefined;
}

async function fetchPilotReport(organizationId?: string): Promise<PilotReport | null> {
  const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : '';
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL;
  try {
    const response = await fetch(`${backendUrl}/api/pilot/report${query}`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as PilotReport;
  } catch {
    return null;
  }
}

function formatActivationDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

export default async function InternalPilotsPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const organizationId = normalizeOrganizationId(resolvedSearchParams.organizationId);
  const report = await fetchPilotReport(organizationId);
  const rows = report?.pilotOrgs ?? [];
  const count = report?.pilotOrgCount ?? rows.length;
  const orgQuery = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : '';

  return (
    <main className="min-h-screen bg-white px-6 py-16 text-black">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">YC pilot</p>
          <h1 className="text-3xl font-semibold">Pilot Organizations</h1>
          <p className="text-sm text-neutral-600">Pilot-facing activation records and artifact generation by org.</p>
        </header>

        {report ? (
          <>
            <div className="flex flex-wrap gap-2">
              <p className="rounded border border-neutral-200 px-3 py-2 text-sm">
                Active organizations: <span className="font-semibold">{count}</span>
              </p>
              {report.isDemoMode ? (
                <p className="rounded border border-neutral-400 px-3 py-2 text-xs uppercase tracking-[0.15em] text-neutral-600">
                  Demo Mode
                </p>
              ) : null}
            </div>

            {rows.length > 0 ? (
              <div className="overflow-x-auto border border-neutral-300">
                <table className="min-w-full divide-y divide-neutral-200 text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-neutral-600">Organization</th>
                      <th className="px-4 py-2 text-left font-semibold text-neutral-600">Contact</th>
                      <th className="px-4 py-2 text-left font-semibold text-neutral-600">Activated</th>
                      <th className="px-4 py-2 text-left font-semibold text-neutral-600">Accepted</th>
                      <th className="px-4 py-2 text-left font-semibold text-neutral-600">Bundles generated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {rows.map((pilot) => (
                      <tr key={pilot.id}>
                        <td className="px-4 py-3 text-sm text-neutral-700">{pilot.name}</td>
                        <td className="px-4 py-3 text-sm text-neutral-500">{pilot.contactEmail}</td>
                        <td className="px-4 py-3 text-sm text-neutral-500">{formatActivationDate(pilot.activatedAt)}</td>
                        <td className="px-4 py-3 text-sm text-neutral-700">{pilot.accepted ? 'yes' : 'pending'}</td>
                        <td className="px-4 py-3 text-sm text-neutral-700">{pilot.bundlesGenerated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded border border-neutral-200 px-4 py-3 text-sm text-neutral-700">
                No pilot orgs have been activated yet.
              </p>
            )}
          </>
        ) : (
          <p className="rounded border border-neutral-300 px-4 py-3 text-sm text-neutral-700">
            Pilot report unavailable. Configure NEXT_PUBLIC_BACKEND_URL.
          </p>
        )}

        <div className="space-y-1 text-sm">
          <p>
            <Link href={`/internal/yc${orgQuery}`} className="underline underline-offset-4">
              Open YC dashboard
            </Link>
          </p>
          <p>
            <Link href={`/internal/metrics${orgQuery}`} className="underline underline-offset-4">
              Open raw internal metrics
            </Link>
          </p>
          <p>
            <Link href={`/internal/enterprise${orgQuery}`} className="underline underline-offset-4">
              Open enterprise signals
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
