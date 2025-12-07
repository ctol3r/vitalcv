import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import type {
  DeviceBindingContext,
  PassportBuilderInput,
  PassportBuilderResult,
  PassportCredential,
  PassportCredentialDomain,
  PassportEnvelope,
  PassportHolder,
  PassportIssuer,
  PassportSummary,
} from './types';
import { issueSdJwt } from './sdJwt';
import { computePassportEnvelopeHash, toBundleManifest } from './utils';

const DEFAULT_ISSUER_DID =
  process.env.PASSPORT_ISSUER_DID || 'did:web:vitalcv.com/passport';
const DEFAULT_ISSUER_NAME =
  process.env.PASSPORT_ISSUER_NAME || 'Vital Credentialing Service';

export class PassportV3Builder {
  constructor(private readonly prisma: PrismaClient = new PrismaClient()) {}

  async build(input: PassportBuilderInput = {}): Promise<PassportBuilderResult> {
    const context = await this.resolveHolderContext(input);
    const passportId = input.passportId ?? randomUUID();
    const issuedAt = new Date().toISOString();
    const issuer = this.resolveIssuer();
    const deviceBinding = input.deviceBinding;

    const [
      licenseCredentials,
      boardCredentials,
      deaCredentials,
      privilegeCredentials,
      oppeCredentials,
    ] = await Promise.all([
      this.buildStateLicenseCredentials(context, passportId, deviceBinding),
      this.buildBoardCredentials(context, passportId, deviceBinding),
      this.buildDeaCredentials(context, passportId, deviceBinding),
      this.buildPrivilegeCredentials(context, passportId, deviceBinding),
      this.buildOppeCredentials(context, passportId, deviceBinding),
    ]);

    const credentials: PassportCredential[] = [
      ...licenseCredentials,
      ...boardCredentials,
      ...deaCredentials,
      ...privilegeCredentials,
      ...oppeCredentials,
    ];

    const summary = summarizeCredentials(credentials);

    const envelope: PassportEnvelope = {
      passportId,
      version: '3.0',
      issuedAt,
      holder: context,
      issuer,
      deviceBinding,
      credentials,
      proofs: [],
      summary,
    };

    const manifest = toBundleManifest(envelope);

    return {
      ...envelope,
      manifest,
      bundleHash: computePassportEnvelopeHash(envelope),
    };
  }

  private async resolveHolderContext(input: PassportBuilderInput): Promise<PassportHolder> {
    if (input.clinicianId) {
      const clinician = await this.prisma.clinicianProfile.findUnique({
        where: { id: input.clinicianId },
        include: {
          user: {
            select: {
              id: true,
              did: true,
              name: true,
            },
          },
        },
      });

      if (!clinician) {
        throw new Error(`Clinician ${input.clinicianId} not found`);
      }

      if (!clinician.user?.did) {
        throw new Error(`Clinician ${input.clinicianId} is missing a DID`);
      }

      return {
        clinicianId: clinician.id,
        userId: String(clinician.user.id),
        did: clinician.user.did,
        npi: clinician.npi,
        name: clinician.user.name,
        state: clinician.state,
      };
    }

    if (!input.userId) {
      throw new Error('clinicianId or userId is required to build passport');
    }

    const clinician = await this.prisma.clinicianProfile.findFirst({
      where: { userId: String(input.userId) },
      include: {
        user: {
          select: {
            id: true,
            did: true,
            name: true,
          },
        },
      },
    });

    if (!clinician || !clinician.user?.did) {
      throw new Error(`Unable to resolve clinician profile for user ${input.userId}`);
    }

    return {
      clinicianId: clinician.id,
      userId: String(clinician.user.id),
      did: clinician.user.did,
      npi: clinician.npi,
      name: clinician.user.name,
      state: clinician.state,
    };
  }

  private resolveIssuer(): PassportIssuer {
    return {
      did: DEFAULT_ISSUER_DID,
      name: DEFAULT_ISSUER_NAME,
    };
  }

  private async buildStateLicenseCredentials(
    holder: PassportHolder,
    passportId: string,
    deviceBinding?: DeviceBindingContext,
  ) {
    const licenses = await this.prisma.stateLicenseVerification.findMany({
      where: { clinicianId: holder.clinicianId },
      orderBy: [{ state: 'asc' }, { updatedAt: 'desc' }],
    });

    return Promise.all(
      licenses.map((license) =>
        this.createCredential({
          domain: 'STATE_LICENSE',
          holder,
          passportId,
          deviceBinding,
          sourceId: license.id,
          issuedAt: license.createdAt?.toISOString() ?? new Date().toISOString(),
          expiresAt: license.expiryDate?.toISOString() ?? null,
          metadata: {
            state: license.state,
            status: license.status,
            licenseNumber: license.licenseNumber,
          },
          claims: {
            type: 'STATE_LICENSE',
            state: license.state,
            licenseNumber: license.licenseNumber,
            status: license.status,
            issuedAt: license.createdAt?.toISOString(),
            expiresAt: license.expiryDate?.toISOString(),
            disciplinaryFlag: license.disciplinaryFlag,
            clinician: {
              id: holder.clinicianId,
              did: holder.did,
              npi: holder.npi,
            },
          },
          selectiveClaims: ['licenseNumber'],
        }),
      ),
    );
  }

  private async buildBoardCredentials(
    holder: PassportHolder,
    passportId: string,
    deviceBinding?: DeviceBindingContext,
  ) {
    const credentials = await this.prisma.credential.findMany({
      where: {
        userId: holder.userId,
        type: 'BoardCertification',
      },
      orderBy: { issuedAt: 'desc' },
    });

    return Promise.all(
      credentials.map((credential) =>
        this.createCredential({
          domain: 'BOARD_CERTIFICATION',
          holder,
          passportId,
          deviceBinding,
          sourceId: credential.id,
          issuedAt: credential.issuedAt.toISOString(),
          expiresAt: credential.expiresAt?.toISOString() ?? null,
          metadata: credential.metadata as Prisma.JsonObject | undefined,
          claims: {
            type: 'BOARD_CERTIFICATION',
            certificationId: credential.id,
            board: credential.issuer,
            status: credential.status,
            specialty: credential.metadata && (credential.metadata as any).specialty,
            issuedAt: credential.issuedAt.toISOString(),
            expiresAt: credential.expiresAt?.toISOString(),
          },
          selectiveClaims: ['certificationId'],
        }),
      ),
    );
  }

  private async buildDeaCredentials(
    holder: PassportHolder,
    passportId: string,
    deviceBinding?: DeviceBindingContext,
  ) {
    const credentials = await this.prisma.credential.findMany({
      where: {
        userId: holder.userId,
        type: 'DEARegistration',
      },
      orderBy: { issuedAt: 'desc' },
    });

    return Promise.all(
      credentials.map((credential) => {
        const metadata = (credential.metadata || {}) as Record<string, unknown>;
        return this.createCredential({
          domain: 'DEA_REGISTRATION',
          holder,
          passportId,
          deviceBinding,
          sourceId: credential.id,
          issuedAt: credential.issuedAt.toISOString(),
          expiresAt: credential.expiresAt?.toISOString() ?? null,
          metadata,
          claims: {
            type: 'DEA_REGISTRATION',
            registrationNumber: metadata.registrationNumber ?? credential.id,
            schedules: metadata.schedules ?? [],
            status: credential.status,
            issuedAt: credential.issuedAt.toISOString(),
            expiresAt: credential.expiresAt?.toISOString(),
          },
          selectiveClaims: ['registrationNumber'],
        });
      }),
    );
  }

  private async buildPrivilegeCredentials(
    holder: PassportHolder,
    passportId: string,
    deviceBinding?: DeviceBindingContext,
  ) {
    const privileges = await this.prisma.privilegeGranted.findMany({
      where: { clinicianDid: holder.did },
      orderBy: { grantedAt: 'desc' },
    });

    return Promise.all(
      privileges.map((privilege) =>
        this.createCredential({
          domain: 'PRIVILEGE',
          holder,
          passportId,
          deviceBinding,
          sourceId: privilege.id,
          issuedAt: privilege.grantedAt.toISOString(),
          expiresAt: privilege.expiresAt?.toISOString() ?? null,
          metadata: {
            orgId: privilege.orgId,
            privilegeSetId: privilege.privilegeSetId,
            status: privilege.status,
          },
          claims: {
            type: 'PRIVILEGE',
            privilegeSetId: privilege.privilegeSetId,
            orgId: privilege.orgId,
            status: privilege.status,
            grantedAt: privilege.grantedAt.toISOString(),
            expiresAt: privilege.expiresAt?.toISOString(),
            temporaryEndDate: privilege.temporaryEndDate?.toISOString(),
          },
        }),
      ),
    );
  }

  private async buildOppeCredentials(
    holder: PassportHolder,
    passportId: string,
    deviceBinding?: DeviceBindingContext,
  ) {
    const cases = await this.prisma.oPPECase.findMany({
      where: { clinicianId: holder.clinicianId },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    return Promise.all(
      cases.map((oppeCase) =>
        this.createCredential({
          domain: 'OPPE',
          holder,
          passportId,
          deviceBinding,
          sourceId: oppeCase.id,
          issuedAt: oppeCase.createdAt.toISOString(),
          expiresAt: oppeCase.periodEnd?.toISOString() ?? null,
          metadata: oppeCase.metrics as Prisma.JsonObject | undefined,
          claims: {
            type: 'OPPE',
            caseId: oppeCase.id,
            status: oppeCase.status,
            periodStart: oppeCase.periodStart?.toISOString(),
            periodEnd: oppeCase.periodEnd?.toISOString(),
            metrics: oppeCase.metrics,
          },
        }),
      ),
    );
  }

  private async createCredential(params: {
    domain: PassportCredentialDomain;
    holder: PassportHolder;
    passportId: string;
    sourceId: string;
    claims: Record<string, unknown>;
    issuedAt: string;
    expiresAt?: string | null;
    metadata?: Record<string, unknown>;
    selectiveClaims?: string[];
    deviceBinding?: DeviceBindingContext;
  }): Promise<PassportCredential> {
    const credentialId = `${params.domain}-${params.sourceId}`;

    const issued = await issueSdJwt(params.claims, {
      issuerDid: this.resolveIssuer().did,
      holderDid: params.holder.did,
      passportId: params.passportId,
      credentialId,
      domain: params.domain,
      selectiveClaims: params.selectiveClaims,
      deviceBinding: params.deviceBinding,
      expiresAt: params.expiresAt ?? undefined,
      metadata: params.metadata,
    });

    return {
      id: credentialId,
      domain: params.domain,
      sourceId: params.sourceId,
      format: 'vc+sd-jwt',
      hash: issued.hash,
      sdJwt: issued.token,
      disclosures: issued.disclosures,
      issuedAt: params.issuedAt,
      expiresAt: params.expiresAt ?? null,
      metadata: params.metadata,
    };
  }
}

function summarizeCredentials(credentials: PassportCredential[]): PassportSummary {
  return credentials.reduce<PassportSummary>(
    (summary, credential) => {
      summary.credentialCount += 1;
      switch (credential.domain) {
        case 'STATE_LICENSE':
          summary.licenseCount += 1;
          break;
        case 'BOARD_CERTIFICATION':
          summary.boardCertificationCount += 1;
          break;
        case 'DEA_REGISTRATION':
          summary.deaRegistrationCount += 1;
          break;
        case 'PRIVILEGE':
          summary.privilegeCount += 1;
          break;
        case 'OPPE':
          summary.oppeCaseCount += 1;
          break;
        default:
          break;
      }
      return summary;
    },
    {
      credentialCount: 0,
      licenseCount: 0,
      boardCertificationCount: 0,
      deaRegistrationCount: 0,
      privilegeCount: 0,
      oppeCaseCount: 0,
    },
  );
}

