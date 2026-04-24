import { notFound } from 'next/navigation';

import { ProfileView } from '@/components/profile/ProfileView';
import { DEMO_PROFILES } from '@/lib/demo/demoProfiles';
import {
  confidenceField,
  fromSource,
  unknownField,
  type ConfidenceField,
} from '@domain-common/dataConfidence';

type ProfileKey = 'fullName' | 'specialty' | 'readiness' | 'estimatedStart';

const FIELD_LABELS: Readonly<Record<ProfileKey, string>> = {
  fullName: 'Name',
  specialty: 'Specialty',
  readiness: 'Readiness',
  estimatedStart: 'Estimated Start',
};

interface ProfilePageProps {
  params: Promise<{ npi: string }> | { npi: string };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { npi: rawNpi } = await params;
  const npi = rawNpi.trim();

  if (!/^\d{10}$/.test(npi)) {
    notFound();
  }

  // Direct lookup, not getDemoProfile — the silent Marcus fallback misleads
  // users by fabricating provider data under an arbitrary NPI. Valid-but-
  // unknown NPIs fall through to the all-unknown branch, exercising
  // ProfileView's I3 safety net end-to-end.
  const demo = DEMO_PROFILES[npi];

  const fields: Readonly<
    Record<ProfileKey, ConfidenceField<unknown> | null>
  > = demo
    ? {
        fullName: confidenceField(demo.name, fromSource('NPPES')),
        specialty: confidenceField(
          demo.specialty,
          fromSource('INFERENCE', { score: 75 }),
        ),
        readiness: confidenceField(demo.readiness, fromSource('INFERENCE')),
        estimatedStart: confidenceField(
          demo.estimatedStart,
          fromSource('INFERENCE'),
        ),
      }
    : {
        fullName: unknownField(null),
        specialty: unknownField(null),
        readiness: unknownField(null),
        estimatedStart: unknownField(null),
      };

  const subtitle = demo
    ? `NPI: ${npi}`
    : `NPI: ${npi} · No enrichment data available`;

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
