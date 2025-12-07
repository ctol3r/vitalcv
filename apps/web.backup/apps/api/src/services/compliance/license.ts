import {
  Prisma,
  PrismaClient,
  StateLicenseVerification,
  ClinicianProfile,
} from '@prisma/client';

const prisma = new PrismaClient();

const BOARD_CACHE_TTL_MINUTES = Number(process.env.STATE_BOARD_CACHE_TTL_MINUTES ?? '720');
const BOARD_CACHE_TTL_MS = BOARD_CACHE_TTL_MINUTES * 60 * 1000;
const BOARD_API_BASE_URL = process.env.STATE_BOARD_API_BASE_URL;
const BOARD_API_TIMEOUT_MS = Number(process.env.STATE_BOARD_API_TIMEOUT_MS ?? '8000');

export interface LicenseAutomationOptions {
  clinicianId: string;
  state?: string;
  licenseNumber?: string;
  forceRefresh?: boolean;
  prisma?: PrismaClient;
}

export interface LicenseAutomationResult {
  complianceCheckId: string;
  clinicianId: string;
  source: string;
  refreshedFromApi: boolean;
  mismatchDetected: boolean;
  license: StateLicenseVerification;
  boardStatus: string;
  boardExpiresAt: string | null;
  checkedAt: string;
}

type BoardStatusSnapshot = {
  source: string;
  status: string;
  expiresAt?: Date | null;
  payload?: Record<string, unknown> | null;
  checkedAt: Date;
  fromApi: boolean;
};

export async function runLicenseComplianceAutomation(
  options: LicenseAutomationOptions
): Promise<LicenseAutomationResult> {
  if (!options.clinicianId) {
    throw new Error('clinicianId is required for license compliance automation');
  }

  const client = options.prisma ?? prisma;
  const clinician = await loadClinicianContext(client, options.clinicianId);
  if (!clinician) {
    throw new Error(`Clinician ${options.clinicianId} not found`);
  }

  const license = await loadLatestLicense(client, {
    clinicianId: options.clinicianId,
    state: options.state ?? clinician.state ?? undefined,
    licenseNumber: options.licenseNumber,
  });

  if (!license) {
    throw new Error(
      `No license record found for clinician ${options.clinicianId}${
        options.state ? ` (${options.state})` : ''
      }`
    );
  }

  const boardStatus = await resolveBoardStatus({
    clinician,
    license,
    forceRefresh: options.forceRefresh,
  });

  const mismatch = hasMismatch(license, boardStatus);
  const shouldUpdateRecord = mismatch || boardStatus.fromApi;

  let updatedLicense = license;
  if (shouldUpdateRecord) {
    updatedLicense = await client.stateLicenseVerification.update({
      where: { id: license.id },
      data: {
        status: boardStatus.status,
        expiryDate: boardStatus.expiresAt ?? license.expiryDate,
        lastCheckedAt: boardStatus.checkedAt,
        sourceMetadata: (boardStatus.payload ?? license.sourceMetadata) as Prisma.InputJsonValue,
        source: boardStatus.source,
      },
    });
  }

  const complianceCheck = await client.complianceCheck.create({
    data: {
      clinicianId: clinician.id,
      type: 'license',
      source: boardStatus.source,
      result: {
        state: updatedLicense.state,
        licenseNumber: updatedLicense.licenseNumber,
        boardStatus: boardStatus.status,
        boardExpiresAt: boardStatus.expiresAt?.toISOString() ?? null,
        recordStatus: license.status,
        recordExpiry: license.expiryDate?.toISOString() ?? null,
        mismatchDetected: mismatch,
        refreshedFromApi: boardStatus.fromApi,
        checkedAt: boardStatus.checkedAt.toISOString(),
        payload: boardStatus.payload ?? null,
      } satisfies Record<string, unknown>,
    },
  });

  return {
    complianceCheckId: complianceCheck.id,
    clinicianId: clinician.id,
    source: boardStatus.source,
    refreshedFromApi: boardStatus.fromApi,
    mismatchDetected: mismatch,
    license: updatedLicense,
    boardStatus: boardStatus.status,
    boardExpiresAt: boardStatus.expiresAt?.toISOString() ?? null,
    checkedAt: boardStatus.checkedAt.toISOString(),
  };
}

async function loadClinicianContext(
  client: PrismaClient,
  clinicianId: string
): Promise<Pick<ClinicianProfile, 'id' | 'npi' | 'state'> | null> {
  return client.clinicianProfile.findUnique({
    where: { id: clinicianId },
    select: {
      id: true,
      npi: true,
      state: true,
    },
  });
}

async function loadLatestLicense(
  client: PrismaClient,
  criteria: {
    clinicianId: string;
    state?: string;
    licenseNumber?: string;
  }
): Promise<StateLicenseVerification | null> {
  const where: Prisma.StateLicenseVerificationWhereInput = {
    clinicianId: criteria.clinicianId,
  };

  if (criteria.state) {
    where.state = criteria.state.toUpperCase();
  }

  if (criteria.licenseNumber) {
    where.licenseNumber = criteria.licenseNumber;
  }

  const [record] = await client.stateLicenseVerification.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 1,
  });

  return record ?? null;
}

async function resolveBoardStatus(input: {
  clinician: Pick<ClinicianProfile, 'npi' | 'state'>;
  license: StateLicenseVerification;
  forceRefresh?: boolean;
}): Promise<BoardStatusSnapshot> {
  const lastChecked =
    input.license.lastCheckedAt ??
    input.license.updatedAt ??
    input.license.createdAt ??
    new Date(0);
  const stale = Date.now() - lastChecked.getTime() > BOARD_CACHE_TTL_MS;
  const shouldUseCache = !input.forceRefresh && (!BOARD_API_BASE_URL || !stale);

  if (shouldUseCache) {
    return {
      source: input.license.source ?? 'state_license_cache',
      status: normalizeStatus(input.license.status),
      expiresAt: input.license.expiryDate,
      payload: (input.license.sourceMetadata as Record<string, unknown> | null) ?? null,
      checkedAt: lastChecked,
      fromApi: false,
    };
  }

  let apiResult: Omit<BoardStatusSnapshot, 'fromApi'> | null = null;
  try {
    apiResult = await queryStateBoardApi({
      state: input.license.state ?? input.clinician.state ?? '',
      licenseNumber: input.license.licenseNumber,
      npi: input.clinician.npi ?? undefined,
    });
  } catch (error) {
    console.warn('[licenseAutomation] state board API lookup failed', {
      message: error instanceof Error ? error.message : String(error),
      state: input.license.state,
      licenseNumber: input.license.licenseNumber,
    });
  }

  if (apiResult) {
    return {
      source: apiResult.source,
      status: apiResult.status,
      expiresAt: apiResult.expiresAt,
      payload: apiResult.payload,
      checkedAt: apiResult.checkedAt,
      fromApi: true,
    };
  }

  return {
    source: input.license.source ?? 'state_license_cache',
    status: normalizeStatus(input.license.status),
    expiresAt: input.license.expiryDate,
    payload: (input.license.sourceMetadata as Record<string, unknown> | null) ?? null,
    checkedAt: new Date(),
    fromApi: false,
  };
}

function hasMismatch(license: StateLicenseVerification, board: BoardStatusSnapshot): boolean {
  const localStatus = normalizeStatus(license.status);
  if (localStatus !== board.status) {
    return true;
  }

  if (license.expiryDate && board.expiresAt) {
    const diff = Math.abs(license.expiryDate.getTime() - board.expiresAt.getTime());
    if (diff > 1000 * 60 * 60 * 24) {
      return true;
    }
  }

  return false;
}

function normalizeStatus(status?: string | null): string {
  return (status ?? 'UNKNOWN').toUpperCase();
}

async function queryStateBoardApi(input: {
  state: string;
  licenseNumber: string;
  npi?: string;
}): Promise<Omit<BoardStatusSnapshot, 'fromApi'>> {
  if (!BOARD_API_BASE_URL) {
    throw new Error('STATE_BOARD_API_BASE_URL is not configured');
  }

  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer =
    controller &&
    setTimeout(() => {
      controller.abort();
    }, BOARD_API_TIMEOUT_MS);

  try {
    const response = await fetch(`${BOARD_API_BASE_URL}/licenses/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        state: input.state,
        licenseNumber: input.licenseNumber,
        npi: input.npi,
      }),
      signal: controller?.signal,
    });

    if (!response.ok) {
      throw new Error(
        `State board API responded with ${response.status} ${response.statusText}`
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const status = normalizeStatus(
      (payload.status as string | undefined) ??
        (payload.licenseStatus as string | undefined) ??
        'UNKNOWN'
    );

    const expiresAt = parseDate(
      (payload.expiresAt as string | undefined) ??
        (payload.expiryDate as string | undefined)
    );

    const boardName =
      (payload.boardName as string | undefined) ??
      (payload.board as string | undefined) ??
      `${input.state} State Board`;

    return {
      source: `state_board_api:${boardName}`,
      status,
      expiresAt,
      payload,
      checkedAt: new Date(),
    };
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function parseDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

