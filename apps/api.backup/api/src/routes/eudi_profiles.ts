/**
 * EUDI Issuer Profiles - Batch 54
 * Exposes trust-service linked issuer profiles for EUDI Wallet
 */

import { Router } from 'express';
import type { IssuerProfile } from '../models/trust';

export const eudiProfiles = Router();

// Default profiles (extend with DB later)
const PROFILES: IssuerProfile[] = [
  {
    profile_id: 'default-sdjwt',
    vc_type: 'VitalCVCredentialRecord',
    disclosure: 'sd-jwt',
    min_assurance: 'low',
  },
  {
    profile_id: 'qualified-physician',
    vc_type: 'PhysicianLicenseCredential',
    trust_service_id: 'eu-cab-medical-001',
    disclosure: 'sd-jwt',
    min_assurance: 'substantial',
  },
];

eudiProfiles.get('/api/eudi/issuer/profiles', (_req, res) => {
  res.json({ ok: true, rows: PROFILES });
});

