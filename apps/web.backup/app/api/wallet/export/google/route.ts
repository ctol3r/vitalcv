import { NextRequest, NextResponse } from 'next/server';

import { buildGoogleWalletPass } from '@/apps/api/src/services/wallet/googlePass';

import { resolveClinicianId } from '../../settings/utils';
import { getWalletCredentialOrMock } from '../../lib/credentials';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { credentialId?: string };
  const clinicianId = resolveClinicianId(request);
  const credential = await getWalletCredentialOrMock(body.credentialId, clinicianId);
  const normalized = normalizeClaims(credential);
  const result = await buildGoogleWalletPass({
    ...normalized.base,
    variant: normalized.variant,
    licenseNumber: normalized.licenseNumber,
    stateCode: normalized.stateCode,
    boardName: normalized.boardName,
    certification: normalized.certification,
  });
  return NextResponse.json(result);
}

function normalizeClaims(credential: Awaited<ReturnType<typeof getWalletCredentialOrMock>>) {
  const payload = credential.payload as Record<string, any>;
  const subject = payload.credentialSubject ?? {};
  const license = subject.license ?? {};
  const board = subject.board ?? {};
  const issuerName =
    subject.issuerName ?? subject.issuer?.name ?? subject.authority ?? 'Vital Credential Vault';

  const variant =
    credential.type.toLowerCase().includes('board') || board.primary ? 'board-cert' : 'license-status';

  return {
    base: {
      credentialId: credential.credentialId,
      clinicianName:
        subject.name?.full ??
        [subject.name?.first, subject.name?.last].filter(Boolean).join(' ') ||
        'Clinician',
      subjectDid: subject.id ?? `did:key:${credential.clinicianId}`,
      status: license.status ?? board.status ?? 'ACTIVE',
      issuedAt: credential.issuedAt.toISOString(),
      expiresAt: license.expires ?? board.expires ?? credential.updatedAt.toISOString(),
      issuerName,
      authority: license.state ?? board.authority ?? 'Regulator',
      qrPayload: credential.credentialId,
    },
    variant,
    licenseNumber: license.number ?? 'UNKNOWN',
    stateCode: license.state ?? 'US',
    boardName: board.primary ?? board.name ?? 'Board',
    certification: board.subspecialty ?? board.primary ?? board.name ?? 'Certification',
  };
}









