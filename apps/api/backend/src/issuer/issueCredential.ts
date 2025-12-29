import { Request } from 'express';
import { issueClinicianIdentityVC } from '../services/clinicianIdentityIssuer';

export async function issueCredential(req: Request) {
  const { credential_request } = req.body ?? {};

  if (!credential_request) {
    throw new Error('Missing credential_request');
  }

  const subject = credential_request.credential_subject ?? {};

  const profile = {
    did: credential_request.subject_id ?? 'did:example:subject',
    name: subject.name ?? 'Test Clinician',
    npi: subject.npi ?? '0000000000',
    specialty: subject.specialty ?? 'General Medicine',
  };

  const vcJws = await issueClinicianIdentityVC(profile);

  return {
    format: 'jwt_vc_json',
    credential: vcJws,
  };
}
