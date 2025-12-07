import { PrismaClient } from '@prisma/client';
import { isDemo } from '../middleware/demo_mode';

const prisma = new PrismaClient();

/**
 * TelehealthAuthz - Unified authorization for telehealth practice
 * Merges compact privileges, state rules, and PSYPACT
 */

export interface AuthzRequest {
  npi: string;
  profession: string; // 'nurse', 'psychologist', 'physician', 'aprn', etc.
  patientState: string;
  mode?: string; // For PSYPACT: 'tele' or 'temp_in_person'
}

export async function checkTelehealthAuthz(req: AuthzRequest) {
  // Demo mode: auto-approve all requests
  if (isDemo()) {
    return {
      authorized: true,
      reasons: ['DEMO MODE: Auto-approved'],
      missing: [],
      patientState: req.patientState,
      profession: req.profession,
      evidence: [{ type: 'demo', label: 'Demo Mode', link: '#' }]
    };
  }

  const reasons: string[] = [];
  const missing: string[] = [];

  // 1. Check compact privileges
  const compactMap: Record<string, string> = {
    nurse: 'nlc',
    psychologist: 'psypact',
    aprn: 'aprn',
    physician: 'imlc',
  };

  const compact = compactMap[req.profession];
  if (compact) {
    const membership = await prisma.compactMatrix.findFirst({
      where: {
        compact,
        state: req.patientState,
        status: 'active',
      },
    });

    if (membership) {
      reasons.push(`${compact.toUpperCase()} compact active in ${req.patientState}`);
    } else {
      missing.push(`${compact.toUpperCase()} compact membership in ${req.patientState}`);
    }
  }

  // 2. Check state telehealth rules
  const stateRule = await prisma.stateRule.findUnique({
    where: { state: req.patientState },
  });

  if (stateRule) {
    const rules = stateRule.rules as any;
    if (rules.registration) {
      missing.push(`State registration: ${rules.registration}`);
    }
    reasons.push(`Jurisdiction: ${rules.jurisdiction || 'patient_state'}`);
  }

  // 3. PSYPACT specific
  if (req.profession === 'psychologist' && req.mode) {
    const psypactCred = await prisma.psypactCredential.findUnique({
      where: { npi: req.npi },
    });

    if (!psypactCred) {
      missing.push('PSYPACT E.Passport credential');
    } else {
      if (req.mode === 'tele' && !psypactCred.apitValid) {
        missing.push('APIT (Authority for Psych Interjurisdictional Telepsychology)');
      }
      if (req.mode === 'temp_in_person' && !psypactCred.tapValid) {
        missing.push('TAP (Temporary Authorization to Practice)');
      }
      if (psypactCred.apitValid || psypactCred.tapValid) {
        reasons.push('PSYPACT credential valid');
      }
    }
  }

  const authorized = missing.length === 0;

  return {
    authorized,
    reasons,
    missing,
    patientState: req.patientState,
    profession: req.profession,
  };
}

