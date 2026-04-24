import { ProfileView } from '@/components/profile/ProfileView';
import { DEMO_PROFILES } from '@/lib/demo/demoProfiles';
import {
  confidenceField,
  fromSource,
  unknownField,
  type ConfidenceSource,
  type ConfidenceField,
} from '@domain-common/dataConfidence';

type ProfileKey =
  | 'npi'
  | 'fullName'
  | 'specialty'
  | 'readiness'
  | 'estimatedStart';

const FIELD_LABELS: Readonly<Record<ProfileKey, string>> = {
  npi: 'NPI',
  fullName: 'Name',
  specialty: 'Specialty',
  readiness: 'Readiness',
  estimatedStart: 'Estimated Start',
};

interface ProfilePageProps {
  params: Promise<{ npi: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { npi: rawNpi } = await params;
  const requestedNpi = typeof rawNpi === 'string' ? rawNpi.trim() : '';
  const validNpi = /^\d{10}$/.test(requestedNpi);
  const lookupNpi = validNpi ? requestedNpi : null;

  // Direct lookup, not getDemoProfile — the silent Marcus fallback misleads
  // users by fabricating provider data under an arbitrary NPI. Valid-but-
  // unknown NPIs fall through to the all-unknown branch, exercising
  // ProfileView's I3 safety net end-to-end.
  const demo = lookupNpi ? DEMO_PROFILES[lookupNpi] : undefined;

  const fields: Readonly<
    Record<ProfileKey, ConfidenceField<unknown> | null>
  > = demo
    ? {
        npi: sourcedField(lookupNpi, 'NPPES'),
        fullName: sourcedField(demo.name, 'NPPES'),
        specialty: sourcedField(demo.specialty, 'INFERENCE', { score: 75 }),
        readiness: sourcedField(demo.readiness, 'INFERENCE'),
        estimatedStart: sourcedField(demo.estimatedStart, 'INFERENCE'),
      }
    : {
        npi: unknownField((lookupNpi ?? requestedNpi) || null),
        fullName: unknownField(null),
        specialty: unknownField(null),
        readiness: unknownField(null),
        estimatedStart: unknownField(null),
      };

  const subtitle = demo
    ? 'Source-backed provider identity'
    : validNpi
      ? 'No enrichment data available'
      : 'Invalid NPI · No enrichment data available';

  return (
    <main className="mx-auto max-w-3xl p-6">
      <ProfileView
        fields={fields}
        fieldLabels={FIELD_LABELS}
        title="Provider Profile"
        subtitle={subtitle}
      />
    </main>
  );
}

function sourcedField(
  value: unknown,
  source: ConfidenceSource,
  overrides?: Parameters<typeof fromSource>[1],
): ConfidenceField<unknown> {
  return hasCandidateValue(value)
    ? confidenceField(value, fromSource(source, overrides))
    : unknownField(null);
}

function hasCandidateValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return true;
}
