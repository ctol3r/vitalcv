import { PrismaClient } from '@prisma/client';
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AuditScrapbook } from '../../backend/src/blockchain/audit_scrapbook';
import { PolkadotService } from '../../backend/src/blockchain/polkadot_service';
import {
  CommitteePacketDocument,
  CommitteePacketDocumentSchema,
  CommitteePacketRecord,
  CommitteePacketStatus,
} from './models/CommitteePacket';

const prisma = new PrismaClient();

const STORAGE_ROOT =
  process.env.COMMITTEE_PACKET_STORAGE_ROOT ?? path.join(process.cwd(), 'artifacts', 'committee-packets');
const KEY_VERSION = process.env.COMMITTEE_PACKET_KEY_VERSION ?? 'v1';
const ENCRYPTION_KEY = process.env.COMMITTEE_PACKET_ENCRYPTION_KEY;

function getEncryptionKey(): Buffer {
  if (!ENCRYPTION_KEY) {
    throw new Error('COMMITTEE_PACKET_ENCRYPTION_KEY is not configured');
  }
  const buffer =
    ENCRYPTION_KEY.length === 43 || ENCRYPTION_KEY.length === 44
      ? Buffer.from(ENCRYPTION_KEY, 'base64')
      : Buffer.from(ENCRYPTION_KEY, 'hex');

  if (buffer.length !== 32) {
    throw new Error('COMMITTEE_PACKET_ENCRYPTION_KEY must be 32 bytes (AES-256)');
  }

  return buffer;
}

interface SaveSnapshotParams {
  clinicianId: string;
  document: CommitteePacketDocument;
  status?: CommitteePacketStatus;
}

interface EncryptionEnvelope {
  iv: string;
  authTag: string;
  ciphertext: string;
}

function encryptPayload(payload: string): EncryptionEnvelope {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(payload, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext: encrypted,
  };
}

function decryptPayload(envelope: EncryptionEnvelope): string {
  const key = getEncryptionKey();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'hex'));
  let decrypted = decipher.update(envelope.ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function writeEncryptedSnapshot(
  clinicianId: string,
  packetId: string,
  envelope: EncryptionEnvelope,
  metadataHash: string
) {
  const targetDir = path.join(STORAGE_ROOT, clinicianId);
  await fs.mkdir(targetDir, { recursive: true });
  const filePath = path.join(targetDir, `${packetId}.json.enc`);
  const content = JSON.stringify(
    {
      version: '1.0',
      iv: envelope.iv,
      authTag: envelope.authTag,
      ciphertext: envelope.ciphertext,
      metadataHash,
    },
    null,
    2
  );
  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
}

export async function saveCommitteePacketSnapshot(params: SaveSnapshotParams): Promise<CommitteePacketRecord> {
  const { clinicianId, document } = params;
  const status = params.status ?? CommitteePacketStatus.GENERATED;
  const packetId = `packet-${uuidv4()}`;
  const snapshotAt = new Date();
  const serialized = JSON.stringify(document);
  const metadataHash = createHash('sha256').update(serialized).digest('hex');
  const encrypted = encryptPayload(serialized);
  const storagePath = await writeEncryptedSnapshot(clinicianId, packetId, encrypted, metadataHash);
  const snapshotSize = Buffer.byteLength(serialized, 'utf8');

  const polkadot = new PolkadotService();
  const auditScrapbook = new AuditScrapbook(polkadot);
  let anchorTxHash: string | null = null;
  let anchoredAt: Date | null = null;

  try {
    anchorTxHash = await polkadot.anchorData(metadataHash);
    anchoredAt = new Date();
    await auditScrapbook.recordIdentityAction(clinicianId, `committee_packet:${packetId}`);
  } catch (error) {
    console.warn('[CommitteePacketSnapshot] Failed to anchor metadata hash', error);
  }

  const record = await prisma.committeePacket.create({
    data: {
      clinicianId,
      packetId,
      snapshotAt,
      status,
      metadataHash,
      storagePath,
      snapshotSize,
      encryptionKeyVersion: KEY_VERSION,
      encryptionIv: encrypted.iv,
      encryptionAuthTag: encrypted.authTag,
      anchorTxHash,
      anchoredAt,
    },
  });

  return record;
}

export async function loadCommitteePacketDocument(record: CommitteePacketRecord): Promise<CommitteePacketDocument> {
  const raw = await fs.readFile(record.storagePath, 'utf8');
  const envelope = JSON.parse(raw) as EncryptionEnvelope & { metadataHash: string };
  const plaintext = decryptPayload(envelope);
  const parsed = JSON.parse(plaintext);
  CommitteePacketDocumentSchema.parse(parsed);
  return parsed;
}
