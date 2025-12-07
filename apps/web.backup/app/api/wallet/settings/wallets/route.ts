import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

import { listEudiIssuerProfiles, getEudiIssuerProfile } from '@/apps/api/src/services/eudi/issuer';
import { transformVitalCredentialToEudiPresentation } from '@/apps/api/src/services/eudi/transform';
import { validateWalletInteroperability } from '@/apps/api/src/services/wallet/interoperability';
import { anchorWalletLinked } from '@/apps/api/src/services/audit/anchor';

import { resolveClinicianId } from '../utils';
import { isPasskeyRecentlyVerified } from '../passkeys/state';
import { getWalletCredentialOrMock } from '../../lib/credentials';

const prisma = new PrismaClient();

interface LinkWalletRequest {
  walletType: 'VCV' | 'EUDI' | 'AppleWallet' | 'GoogleWallet';
  walletHandle?: string;
  provider?: string;
  profileId?: string;
  credentialId?: string;
  passkeyId?: string;
}

export async function GET(request: NextRequest) {
  const clinicianId = resolveClinicianId(request);
  const [wallets, profiles] = await Promise.all([
    prisma.walletProfile.findMany({
      where: { clinicianId },
      orderBy: { createdAt: 'desc' },
    }),
    Promise.resolve(listEudiIssuerProfiles()),
  ]);

  return NextResponse.json({
    clinicianId,
    wallets,
    issuerProfiles: profiles,
  });
}

export async function POST(request: NextRequest) {
  const clinicianId = resolveClinicianId(request);
  const body = (await request.json()) as LinkWalletRequest;

  if (!body.walletType) {
    return NextResponse.json({ error: 'wallet_type_required' }, { status: 400 });
  }

  if (body.passkeyId && !isPasskeyRecentlyVerified(body.passkeyId)) {
    return NextResponse.json(
      { error: 'passkey_required', message: 'Passkey verification required within the last 5 minutes.' },
      { status: 412 },
    );
  }

  let interoperabilityReport = null;
  let presentationPayload = null;

  if (body.walletType === 'EUDI') {
    if (!body.credentialId) {
      return NextResponse.json(
        { error: 'credential_required', message: 'credentialId required for EUDI wallet linking.' },
        { status: 400 },
      );
    }
    let credential;
    try {
      credential = await getWalletCredentialOrMock(body.credentialId, clinicianId);
    } catch (error) {
      return NextResponse.json(
        {
          error: 'credential_access_denied',
          message:
            error instanceof Error ? error.message : 'Credential could not be loaded for this clinician.',
        },
        { status: 403 },
      );
    }
    const presentation = transformVitalCredentialToEudiPresentation({
      credential,
      profileId: body.profileId,
      selectiveDisclosure: {
        identity: true,
        qualifications: true,
        sanctionFree: true,
      },
    });
    const validation = validateWalletInteroperability({
      credential: presentation.credential,
      profile: presentation.profile,
      presentation,
    });
    if (!validation.ok) {
      return NextResponse.json(
        {
          error: 'interoperability_failed',
          report: validation,
        },
        { status: 422 },
      );
    }
    interoperabilityReport = validation;
    presentationPayload = presentation;
  }

  const record = await prisma.walletProfile.upsert({
    where: {
      clinicianId_walletType: {
        clinicianId,
        walletType: body.walletType,
      },
    },
    update: {
      walletHandle: body.walletHandle ?? body.provider ?? null,
    },
    create: {
      clinicianId,
      walletType: body.walletType,
      walletHandle: body.walletHandle ?? body.provider ?? null,
    },
  });

  anchorWalletLinked({
    clinicianId,
    walletType: body.walletType,
    walletHandle: record.walletHandle,
    provider: body.provider,
    passkeyBinding: Boolean(body.passkeyId),
    presentationProfile: presentationPayload?.profile.profileId,
  });

  return NextResponse.json({
    wallet: record,
    interoperability: interoperabilityReport,
    presentation: presentationPayload,
  });
}


