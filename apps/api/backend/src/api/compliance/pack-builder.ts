import crypto from 'crypto';
import prisma from '../../graphql/prisma_client';
import { CompliancePack, EvidenceItem } from './models';

const SUPPORTED_TYPES: CompliancePack['type'][] = ['soc2', 'hipaa', 'ncqa'];

function merkleRootHex(hashes: string[]): string | null {
  if (hashes.length === 0) return null;
  let layer: Buffer<ArrayBufferLike>[] = hashes.map((h) => Buffer.from(h, 'hex'));
  while (layer.length > 1) {
    const next: Buffer<ArrayBufferLike>[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = layer[i + 1] ?? layer[i];
      next.push(
        crypto
          .createHash('sha256')
          .update(Buffer.concat([left, right]))
          .digest(),
      );
    }
    layer = next;
  }
  return layer[0].toString('hex');
}

function asArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function isAccessDenied(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  const meta = metadata as Record<string, unknown>;
  const status = String(meta.status || '').toLowerCase();
  const allowed = meta.allowed;
  const success = meta.success;
  return (
    status === 'denied' ||
    status === 'forbidden' ||
    allowed === false ||
    success === false ||
    asArray(meta.outcome).some((v) => String(v).toLowerCase().includes('deny'))
  );
}

export function resolvePackType(raw: string): CompliancePack['type'] | null {
  const normalized = String(raw || '').trim().toLowerCase() as CompliancePack['type'];
  return SUPPORTED_TYPES.includes(normalized) ? normalized : null;
}

export async function buildCompliancePack(packType: CompliancePack['type']): Promise<CompliancePack> {
  const recentAuditEvents = await prisma.auditEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const auditHashes = recentAuditEvents.map((e) => e.hash).filter(Boolean);
  const merkleRoot = merkleRootHex(auditHashes);
  const anchorReference = String(process.env.AUDIT_ANCHOR_REFERENCE || '').trim() || null;

  const accessDenials = recentAuditEvents.filter(
    (event) =>
      event.type.toUpperCase().includes('DENY') ||
      event.type.toUpperCase().includes('FAIL') ||
      isAccessDenied(event.metadata),
  );

  const [credentialCount, issuanceCount, verificationCount, revocationCount, lifecycleEvents] =
    await Promise.all([
      prisma.credential.count(),
      prisma.auditEvent.count({ where: { type: 'ISSUE_CREDENTIAL' } }),
      prisma.auditEvent.count({ where: { type: 'VERIFY_PRESENTATION' } }),
      prisma.auditEvent.count({ where: { type: 'REVOKE_CREDENTIAL' } }),
      prisma.auditEvent.findMany({
        where: { type: { in: ['ISSUE_CREDENTIAL', 'VERIFY_PRESENTATION', 'REVOKE_CREDENTIAL'] } },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
    ]);

  const auditTrailItem: EvidenceItem = {
    id: 'audit-events',
    category: 'audit',
    description: 'Recent audit entries proving credential activity is logged with hashes only.',
    refs: [
      { label: 'recentEventCount', value: String(recentAuditEvents.length), type: 'count' },
      recentAuditEvents[0]
        ? {
            label: 'latestEventHash',
            value: recentAuditEvents[0].hash,
            type: 'hash',
            metadata: { at: recentAuditEvents[0].createdAt.toISOString() },
          }
        : { label: 'latestEventHash', value: 'none', type: 'status' },
      merkleRoot ? { label: 'rollingMerkleRoot', value: merkleRoot, type: 'hash' } : null,
    ].filter(Boolean) as EvidenceItem['refs'],
  };

  const merkleAnchorItem: EvidenceItem = {
    id: 'anchored-merkle-root',
    category: 'anchor',
    description:
      'Anchored Merkle root derived from the audit log hash chain to demonstrate tamper-evidence.',
    refs: [
      merkleRoot
        ? { label: 'merkleRoot', value: merkleRoot, type: 'hash' }
        : { label: 'merkleRoot', value: 'unavailable', type: 'status' },
      anchorReference
        ? { label: 'anchorReference', value: anchorReference, type: 'anchor' }
        : { label: 'anchorReference', value: 'not-configured', type: 'status' },
    ],
  };

  const accessDenialsItem: EvidenceItem = {
    id: 'access-denials',
    category: 'access',
    description: 'Denied or failed access attempts captured from the audit stream.',
    refs: [
      { label: 'denialCount', value: String(accessDenials.length), type: 'count' },
      ...accessDenials.slice(0, 5).map((event) => ({
        label: event.type,
        value: event.hash,
        type: 'event' as const,
        metadata: {
          at: event.createdAt.toISOString(),
          status: (event.metadata as any)?.status ?? null,
        },
      })),
    ],
  };

  const lifecycleItem: EvidenceItem = {
    id: 'credential-lifecycle',
    category: 'credential',
    description: 'Lifecycle checkpoints for issuance, verification, and revocation.',
    refs: [
      { label: 'credentialRecords', value: String(credentialCount), type: 'count' },
      { label: 'issuanceEvents', value: String(issuanceCount), type: 'count' },
      { label: 'verificationEvents', value: String(verificationCount), type: 'count' },
      { label: 'revocationEvents', value: String(revocationCount), type: 'count' },
      ...lifecycleEvents.map((event) => ({
        label: event.type,
        value: event.hash,
        type: 'event' as const,
        metadata: { at: event.createdAt.toISOString() },
      })),
    ],
  };

  return {
    type: packType,
    generatedAt: new Date().toISOString(),
    items: [auditTrailItem, merkleAnchorItem, accessDenialsItem, lifecycleItem],
    stats: {
      auditEvents: recentAuditEvents.length,
      credentials: credentialCount,
      accessDenials: accessDenials.length,
    },
  };
}
