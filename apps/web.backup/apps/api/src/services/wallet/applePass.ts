import { createHash } from 'node:crypto';
import { execFile as execFileCb } from 'node:child_process';
import { tmpdir } from 'node:os';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

export type AppleWalletPassVariant = 'license-status' | 'board-cert';

export interface BasePassInput {
  credentialId: string;
  clinicianName: string;
  subjectDid?: string;
  status: string;
  issuedAt: string;
  expiresAt?: string | null;
  issuerName: string;
  authority: string;
  qrPayload?: string;
}

export interface LicenseStatusPassInput extends BasePassInput {
  licenseNumber: string;
  stateCode: string;
}

export interface BoardCertificationPassInput extends BasePassInput {
  boardName: string;
  certification: string;
}

export interface AppleWalletPassResult {
  buffer: Buffer;
  fileName: string;
  manifest: Record<string, string>;
}

const PASS_TYPE_IDENTIFIER =
  process.env.APPLE_WALLET_PASS_TYPE_ID ?? 'pass.com.vitalcv.credential';
const TEAM_IDENTIFIER = process.env.APPLE_WALLET_TEAM_ID ?? 'VITALCVTEAM';

export async function buildLicenseStatusPkpass(
  input: LicenseStatusPassInput,
): Promise<AppleWalletPassResult> {
  const passJson = buildBasePassJson({
    ...input,
    variant: 'license-status',
    primaryLabel: input.clinicianName,
    secondaryLabel: `${input.licenseNumber} · ${input.stateCode}`,
    auxiliaryLabel: input.status,
    headerFields: [
      { key: 'status', label: 'Status', value: input.status },
      { key: 'state', label: 'State', value: input.stateCode },
    ],
    backFields: [
      { key: 'number', label: 'License #', value: input.licenseNumber },
      { key: 'authority', label: 'Authority', value: input.authority },
    ],
  });

  return packagePkpass(passJson, input.credentialId, 'license-status');
}

export async function buildBoardCertificationPkpass(
  input: BoardCertificationPassInput,
): Promise<AppleWalletPassResult> {
  const passJson = buildBasePassJson({
    ...input,
    variant: 'board-cert',
    primaryLabel: input.clinicianName,
    secondaryLabel: input.boardName,
    auxiliaryLabel: input.certification,
    headerFields: [
      { key: 'board', label: 'Board', value: input.boardName },
      { key: 'status', label: 'Status', value: input.status },
    ],
    backFields: [
      { key: 'cert', label: 'Certification', value: input.certification },
      { key: 'authority', label: 'Authority', value: input.authority },
    ],
  });

  return packagePkpass(passJson, input.credentialId, 'board-cert');
}

interface PassVisualFields {
  primaryLabel: string;
  secondaryLabel: string;
  auxiliaryLabel: string;
  headerFields: Array<{ key: string; label: string; value: string }>;
  backFields: Array<{ key: string; label: string; value: string }>;
  variant: AppleWalletPassVariant;
}

function buildBasePassJson(input: BasePassInput & PassVisualFields) {
  return {
    formatVersion: 1,
    passTypeIdentifier: PASS_TYPE_IDENTIFIER,
    serialNumber: input.credentialId,
    teamIdentifier: TEAM_IDENTIFIER,
    organizationName: input.issuerName,
    description: `VitalCV ${input.variant === 'license-status' ? 'License Status' : 'Board Certification'}`,
    labelColor: '#0f172a',
    foregroundColor: '#ffffff',
    backgroundColor: input.variant === 'license-status' ? '#0f172a' : '#1d4ed8',
    expirationDate: input.expiresAt ?? undefined,
    relevantDate: input.issuedAt,
    barcode: {
      message: input.qrPayload ?? input.credentialId,
      format: 'PKBarcodeFormatQR',
      messageEncoding: 'iso-8859-1',
      altText: input.credentialId,
    },
    generic: {
      primaryFields: [
        {
          key: 'name',
          label: 'Clinician',
          value: input.primaryLabel,
        },
      ],
      secondaryFields: [
        {
          key: 'detail',
          label: input.variant === 'license-status' ? 'License' : 'Board',
          value: input.secondaryLabel,
        },
      ],
      auxiliaryFields: [
        {
          key: 'status',
          label: 'Status',
          value: input.auxiliaryLabel,
        },
      ],
      headerFields: input.headerFields,
      backFields: [
        ...input.backFields,
        {
          key: 'issued',
          label: 'Issued',
          value: new Date(input.issuedAt).toLocaleString('en-US'),
        },
        ...(input.expiresAt
          ? [
              {
                key: 'expires',
                label: 'Expires',
                value: new Date(input.expiresAt).toLocaleString('en-US'),
              },
            ]
          : []),
      ],
    },
    metadata: {
      subjectDid: input.subjectDid,
      variant: input.variant,
    },
  };
}

async function packagePkpass(passJson: Record<string, unknown>, credentialId: string, prefix: string) {
  const files: Record<string, Buffer> = {
    'pass.json': Buffer.from(JSON.stringify(passJson, null, 2), 'utf-8'),
    'logo.png': placeholderPng(),
    'icon.png': placeholderPng(),
    'strip.png': placeholderStripPng(),
  };

  const manifest: Record<string, string> = {};
  for (const [name, buffer] of Object.entries(files)) {
    manifest[name] = createHash('sha1').update(buffer).digest('hex');
  }
  files['manifest.json'] = Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8');
  files['signature'] = Buffer.from(
    JSON.stringify(
      {
        note: 'Development build – real Apple Wallet signatures require WWDR certificates.',
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    'utf-8',
  );

  const buffer = await zipBuffers(files);
  return {
    buffer,
    manifest,
    fileName: `${prefix}-${credentialId}.pkpass`,
  };
}

async function zipBuffers(files: Record<string, Buffer>): Promise<Buffer> {
  const baseDir = await mkdtemp(join(tmpdir(), 'vital-pkpass-'));
  try {
    await Promise.all(
      Object.entries(files).map(async ([name, data]) => {
        const fullPath = join(baseDir, name);
        await mkdir(dirname(fullPath), { recursive: true });
        await writeFile(fullPath, data);
      }),
    );

    const archivePath = join(baseDir, 'pass.pkpass');
    await execFile('zip', ['-r', '-q', archivePath, '.'], { cwd: baseDir });
    return await readFile(archivePath);
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
}

function placeholderPng(): Buffer {
  // 1x1 px PNG (gray)
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAoMBgVx1oN8AAAAASUVORK5CYII=';
  return Buffer.from(base64, 'base64');
}

function placeholderStripPng(): Buffer {
  // 3x1 px PNG used as strip placeholder
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAMAAAABCAQAAAD8fJRsAAAAD0lEQVR42mP4//8/AwAI/wP+L2Au1wAAAABJRU5ErkJggg==';
  return Buffer.from(base64, 'base64');
}


