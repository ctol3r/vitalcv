import { pool } from '../db';

export async function computeAuthzV3({
  patient,
  npi,
  profession,
  mode
}: {
  patient: string;
  npi?: string;
  profession: 'physician' | 'nurse' | 'aprn' | 'psych' | 'pt' | 'ot';
  mode: 'tele' | 'temp';
}) {
  const reasons: string[] = ['practice_jurisdiction=patient_state'];
  const missing: string[] = [];
  const evidence: any[] = [];
  let authorized = false;

  // 1) Check active state license
  if (npi) {
    const { rows } = await pool.query(
      'SELECT state FROM "License" WHERE npi=$1 AND status=\'active\'',
      [npi]
    );

    authorized = rows.some(r => (r.state || '').toUpperCase() === patient.toUpperCase());

    if (authorized) {
      reasons.push('active_state_license');
    } else {
      missing.push('state_license:' + patient);
    }
  }

  // 2) Compacts by profession
  const { rows: cm } = await pool.query(
    'SELECT compact, status, special_rules FROM "CompactMatrix" WHERE state=$1',
    [patient]
  );

  const compacts = new Map(cm.map(r => [r.compact, r]));

  if (!authorized) {
    if (profession === 'physician' && compacts.has('imlc')) {
      reasons.push('imlc_member');
      authorized = true;
    }

    if (profession === 'nurse' && compacts.has('nlc')) {
      reasons.push('nlc_multistate');
      // TODO: check 60-day move state
      authorized = true;
    }

    if (profession === 'aprn' && compacts.has('aprn')) {
      reasons.push('aprn_compact');
      authorized = true;
    }

    if (profession === 'psych' && compacts.has('psypact')) {
      reasons.push('psypact');
      // Enforce PSYPACT authority
      if (npi) {
        const { lookupPsypactByNpi } = await import('../adapters/psypact_registry');
        const status = await lookupPsypactByNpi(npi);

        // Add PSYPACT registry evidence link
        evidence.push({
          type: 'psypact',
          label: 'PSYPACT Registry',
          link: 'https://psypact.org'
        });

        if (mode === 'tele') {
          reasons.push('apit_required');
          if (status.apit) {
            evidence.push({
              type: 'psypact_apit',
              npi,
              epassport: status.epassport,
              expires: status.expires_at,
              label: 'APIT (Authority for Interjurisdictional Practice of Telepsychology)',
              link: 'https://psypact.org/page/APIT'
            });
            authorized = true;
          } else {
            missing.push('APIT');
            authorized = false;
          }
        }
        if (mode === 'temp') {
          reasons.push('tap_required');
          if (status.tap) {
            evidence.push({
              type: 'psypact_tap',
              npi,
              epassport: status.epassport,
              expires: status.expires_at,
              label: 'TAP (Temporary Authorization to Practice)',
              link: 'https://psypact.org/page/TAP'
            });
            authorized = true;
          } else {
            missing.push('TAP');
            authorized = false;
          }
        }
      }
    }
  }

  return { authorized, reasons, missing, evidence };
}
