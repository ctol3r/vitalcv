/**
 * Training path extractor
 * Infers training → role → specialty transitions
 */

export interface TrainingPath {
  clinicianId: string;
  path: Array<{
    phase: string;
    specialty?: string;
    role: string;
    startDate?: string;
    endDate?: string;
    credentialIds: string[];
  }>;
  transitions: Array<{
    from: string;
    to: string;
    type: 'specialty_change' | 'role_promotion' | 'training_completion';
    timestamp?: string;
  }>;
}

export function trainingPathExtractor(clinicianId: string, credentials: any[]): TrainingPath {
  // Sort credentials by date
  const sorted = credentials
    .filter(c => c.issuedAt || c.startDate)
    .sort((a, b) => {
      const dateA = new Date(a.issuedAt || a.startDate || 0).getTime();
      const dateB = new Date(b.issuedAt || b.startDate || 0).getTime();
      return dateA - dateB;
    });

  const path: TrainingPath['path'] = [];
  const transitions: TrainingPath['transitions'] = [];
  let currentPhase = 'training';
  let currentSpecialty: string | undefined;
  let currentRole = 'TRAINEE';
  let previousPhase: string | undefined;

  sorted.forEach((cred, index) => {
    const credType = cred.type || cred.credentialType || 'unknown';
    const specialty = cred.specialty || cred.taxonomyCode;
    const role = cred.role || 'CLINICIAN';

    // Determine phase
    if (credType.includes('training') || credType.includes('residency')) {
      currentPhase = 'training';
      currentRole = 'TRAINEE';
    } else if (credType.includes('license') || credType.includes('board')) {
      currentPhase = 'licensed';
      currentRole = role;
    } else if (credType.includes('privilege')) {
      currentPhase = 'privileged';
      currentRole = 'PRIVILEGED';
    }

    // Detect transitions
    if (previousPhase && previousPhase !== currentPhase) {
      transitions.push({
        from: previousPhase,
        to: currentPhase,
        type: currentPhase === 'licensed' ? 'training_completion' : 'role_promotion',
        timestamp: cred.issuedAt || cred.startDate,
      });
    }

    if (currentSpecialty && specialty && currentSpecialty !== specialty) {
      transitions.push({
        from: currentSpecialty,
        to: specialty,
        type: 'specialty_change',
        timestamp: cred.issuedAt || cred.startDate,
      });
    }

    // Add to path
    path.push({
      phase: currentPhase,
      specialty: specialty || currentSpecialty,
      role: currentRole,
      startDate: cred.startDate || cred.issuedAt,
      endDate: cred.expiresAt || cred.endDate,
      credentialIds: [cred.id || cred.credentialId],
    });

    if (specialty) currentSpecialty = specialty;
    previousPhase = currentPhase;
  });

  return {
    clinicianId,
    path,
    transitions,
  };
}








