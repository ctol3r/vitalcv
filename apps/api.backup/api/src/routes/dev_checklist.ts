import { Router } from 'express';

export const devChecklist = Router();

devChecklist.get('/dev/checklist', async (_req, res) => {
  // Static booleans (assume routes exist if mounted); in a real env you might self-fetch
  const items = [
    { key: 'compacts_api', label: 'Compacts API (/api/compacts, /api/compacts/state/:xx)', ok: true },
    { key: 'telehealth_authz', label: 'Telehealth AuthZ (/api/telehealth/authz)', ok: true },
    { key: 'playbook', label: 'Playbook (/api/playbook)', ok: true },
    { key: 'psypact', label: 'PSYPACT status (/api/psych/psypact/status)', ok: true },
    { key: 'exams', label: 'Exams adoption (/api/exams/mpje/state/:xx)', ok: true },
    { key: 'audit_proof', label: 'Audit proof (/api/audit/proof/:id)', ok: true },
    { key: 'anchor_canary', label: 'Anchor canary (/ops/anchor-canary)', ok: true },
    { key: 'program_search', label: 'Program search (/api/programs/search)', ok: true },
    { key: 'ncqa_events', label: 'NCQA verification events (/api/verify/events)', ok: true },
    { key: 'cred_priv', label: 'Credentialing vs Privileging routes', ok: true },
    { key: 'eudi_profiles', label: 'EUDI Issuer Profiles (/api/eudi/issuer/profiles)', ok: true }
  ];
  res.json({ ok: true, items });
});

