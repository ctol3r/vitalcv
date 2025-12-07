import { NextRequest, NextResponse } from 'next/server';

import { buildBoardCertificationPkpass, buildLicenseStatusPkpass } from '@/apps/api/src/services/wallet/applePass';

import { resolveClinicianId } from '../../settings/utils';
import { getWalletCredentialOrMock } from '../../lib/credentials';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { credentialId?: string };
  const clinicianId = resolveClinicianId(request);
  const credential = await getWalletCredentialOrMock(body.credentialId, clinicianId);
  const variant = resolveVariant(credential.type);
  const normalized = normalizeClaims(credential);

  if (variant === 'board-cert') {
    const result = await buildBoardCertificationPkpass({
      ...normalized.base,
      boardName: normalized.board.boardName,
      certification: normalized.board.certification,
    });
    return buildBinaryResponse(result);
  }

  const result = await buildLicenseStatusPkpass({
    ...normalized.base,
    licenseNumber: normalized.license.licenseNumber,
    stateCode: normalized.license.stateCode,
  });
  return buildBinaryResponse(result);
}

function buildBinaryResponse(result: Awaited<ReturnType<typeof buildLicenseStatusPkpass>>) {
  return new NextResponse(result.buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
    },
  });
}

function resolveVariant(type: string): 'license-status' | 'board-cert' {
  const normalized = type.toLowerCase();
  if (normalized.includes('board')) {
    return 'board-cert';
  }
  return 'license-status';
}

function normalizeClaims(credential: Awaited<ReturnType<typeof getWalletCredentialOrMock>>) {
  const payload = credential.payload as Record<string, any>;
  const subject = payload?.credentialSubject ?? {};
  const license = subject.license ?? {};
  const sanction = subject.sanction ?? {};
  const board = subject.board ?? {};
  const issuerName =
    subject.issuerName ?? subject.issuer?.name ?? subject.authority ?? 'Vital Credential Vault';

  return {
    base: {
      credentialId: credential.credentialId,
      clinicianName:
        subject.name?.full ??
        [subject.name?.first, subject.name?.last].filter(Boolean).join(' ') ||
        'Clinician',
      subjectDid: subject.id ?? `did:key:${credential.clinicianId}`,
      status: license.status ?? board.status ?? sanction.status ?? 'active',
      issuedAt: credential.issuedAt.toISOString(),
      expiresAt: license.expires ?? board.expires ?? credential.updatedAt.toISOString(),
      issuerName,
      authority: license.state ?? board.authority ?? 'Regulatory Authority',
      qrPayload: credential.credentialId,
    },
    license: {
      licenseNumber: license.number ?? 'UNKNOWN',
      stateCode: license.state ?? 'US',
    },
    board: {
      boardName: board.primary ?? board.name ?? 'Board',
      certification: board.subspecialty ?? board.primary ?? board.name ?? 'Certification',
    },
  };
}

