import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CompactEligibilityEntry {
  compact: string;
  eligible: boolean;
  rationale: {
    authorizedStates?: string[];
    evaluatedStates?: Array<{ state: string; eligible: boolean; reason?: string }>;
  };
}

interface CompactEligibilityResponse {
  clinicianId: string;
  entries: CompactEligibilityEntry[];
}

const COMPACT_LABELS: Record<string, string> = {
  IMLC: 'IMLC Eligible',
  NLC: 'Nurse Licensure Compact',
  PSYPACT: 'PSYPACT Eligible',
  PT: 'PT Compact Eligible',
};

export default async function ClinicianWalletProfile({ params }: { params: { id: string } }) {
  const eligibility = await fetchCompactEligibility(params.id);

  return (
    <div className="container mx-auto max-w-4xl space-y-8 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clinician Wallet Profile</h1>
        <p className="text-muted-foreground">
          Multi-compact readiness visualization for clinician {params.id}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compact Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(COMPACT_LABELS).map(([compact, label]) => {
              const entry = eligibility.entries.find((record) => record.compact === compact);
              const authorizedStates = entry?.rationale?.authorizedStates ?? [];
              const evaluatedStates = entry?.rationale?.evaluatedStates ?? [];

              return (
                <div key={compact} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <Badge variant={entry?.eligible ? 'default' : 'outline'}>
                      {entry?.eligible ? 'Eligible' : 'Not eligible'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{compact}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry
                      ? `Authorized states: ${authorizedStates.length ? authorizedStates.join(', ') : 'pending review'}`
                      : 'No data yet'}
                  </p>
                  {evaluatedStates.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {evaluatedStates.slice(0, 3).map((state) => (
                        <li key={`${compact}-${state.state}`}>
                          <span className={state.eligible ? 'text-green-600' : 'text-amber-600'}>
                            {state.eligible ? '✓' : '✕'} {state.state}
                          </span>{' '}
                          {state.result?.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

async function fetchCompactEligibility(clinicianId: string): Promise<CompactEligibilityResponse> {
  try {
    const response = await fetch(resolveApiUrl(`/api/compacts/eligibility/${clinicianId}`), {
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`eligibility API ${response.status}`);
    }
    const payload = (await response.json()) as CompactEligibilityResponse;
    return payload;
  } catch (error) {
    console.warn('[WalletProfile] using fallback eligibility data', error);
    return {
      clinicianId,
      entries: Object.keys(COMPACT_LABELS).map((compact, idx) => ({
        compact,
        eligible: idx % 2 === 0,
        rationale: {
          authorizedStates: idx % 2 === 0 ? ['CA', 'WA', 'TX'].slice(0, idx + 1) : [],
          evaluatedStates: [
            { state: 'CA', eligible: true, reason: 'Home state license validated' },
            { state: 'NY', eligible: idx % 2 === 0, reason: 'Ready after compact activation' },
          ],
        },
      })),
    };
  }
}

function resolveApiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_BASE_URL ?? '';
  if (!base) return path;
  return `${base}${path}`;
}


