import { notFound } from 'next/navigation';

import { ProfileView } from '@/components/profile/ProfileView';
import {
  confidenceField,
  fromSource,
  unknownField,
} from '@domain-common/dataConfidence';

interface ProfilePageProps {
  params: Promise<{ npi: string }> | { npi: string };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { npi: rawNpi } = await params;
  const npi = rawNpi.trim();

  if (!/^\d{10}$/.test(npi)) {
    notFound();
  }

  // Mock data for wiring
  const fields = {
    firstName: confidenceField('Macie', fromSource('NPPES')),
    lastName: confidenceField('Miller', fromSource('NPPES')),
    credential: confidenceField('PA-C', fromSource('STATE_BOARD')),
    specialty: confidenceField(
      'Emergency Medicine',
      fromSource('INFERENCE', { score: 75 }),
    ),
    yearsExperience: unknownField(null),
  };

  const fieldLabels = {
    firstName: 'First Name',
    lastName: 'Last Name',
    credential: 'Credential',
    specialty: 'Specialty',
    yearsExperience: 'Years Experience',
  };

  return (
    <main className="mx-auto max-w-3xl p-6">
      <ProfileView
        fields={fields}
        fieldLabels={fieldLabels}
        title="Provider Profile"
        subtitle={`NPI: ${npi}`}
      />
    </main>
  );
}
