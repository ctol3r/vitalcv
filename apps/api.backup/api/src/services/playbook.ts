import { pool } from '../db';

export async function buildPlaybook(prof: string, state: string) {
  const steps: string[] = [];
  const proofs: any[] = [];
  const s = state.toUpperCase();

  // universal telehealth rule (patient location) and compacts
  steps.push('Confirm license/compact eligibility in patient state');
  proofs.push({
    type: 'policy',
    label: 'Telehealth jurisdiction',
    link: 'https://www.cchpca.org'
  });

  if (prof === 'physician') {
    steps.push('FCVS profile up to date → State license');
    steps.push('NPI (NPPES) + DEA (MATE 8-hr)');
    steps.push('ABMS/AOA board cert check');
    steps.push('IMLC if multi-state');
    steps.push(
      'Hospital credentialing vs privileging; NPDB/OIG; temp-priv ≤120 days'
    );
    steps.push('Enroll: CAQH + PECOS');
  }

  if (prof === 'aprn') {
    steps.push('RN → APRN program → national cert → state APRN license');
    steps.push('APRN Compact eligibility');
    steps.push('NPDB (biennial) + CAQH re-attest + PECOS if applicable');
    steps.push('DEA/MATE if CS prescribing; state CS requirements');
  }

  if (prof === 'psych') {
    steps.push('EPPP Parts 1/2 per jurisdiction; supervised hours');
    steps.push('PSYPACT APIT (tele) or TAP (temp in-person); E.Passport');
  }

  if (prof === 'pt' || prof === 'ot') {
    steps.push('Home state license; PT/OT Compact privileges per remote state');
  }

  if (prof === 'pharmacist') {
    steps.push(
      'Accredited PharmD → NAPLEX (post-2025 outline) → MPJE (state or Uniform from 2026) → state license'
    );
    steps.push('CAQH profile + payer enrollment; PECOS if applicable');
  }

  // Normalize proofs: de-duplicate by link and sort by type
  const uniqueProofs = Array.from(
    new Map(proofs.map(p => [p.link, p])).values()
  ).sort((a, b) => a.type.localeCompare(b.type));

  return { profession: prof, state: s, steps, proofs: uniqueProofs };
}

