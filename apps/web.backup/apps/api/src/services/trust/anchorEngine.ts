import { PrismaClient } from '@prisma/client';
import { differenceInHours } from 'date-fns';
import { anchorTrustAnchorSnapshot } from '../audit/anchor';

const prisma = new PrismaClient();
const ALERT_THRESHOLD = Number(process.env.TRUST_ANCHOR_ALERT_THRESHOLD ?? 0.58);

type ExtendedPrisma = PrismaClient & Record<string, any>;

export interface TrustAnchorScore {
  id: string;
  entityDid: string;
  entityType: 'issuer' | 'employer' | 'validator' | 'wallet';
  score: number;
  metadata: Record<string, unknown>;
  alerts?: string[];
  blocked?: boolean;
}

export interface TrustAnchorSnapshot {
  generatedAt: string;
  issuers: TrustAnchorScore[];
  employers: TrustAnchorScore[];
  validators: TrustAnchorScore[];
  wallets: TrustAnchorScore[];
  alerts: Array<{ entityDid: string; reason: string }>;
  blockedEntities: string[];
}

export async function calculateTrustAnchors(options: { prisma?: PrismaClient } = {}) {
  const client = (options.prisma ?? prisma) as ExtendedPrisma;
  const [issuers, employers, validators, wallets] = await Promise.all([
    evaluateIssuerAnchors(client),
    evaluateEmployerAnchors(client),
    evaluateValidatorAnchors(client),
    evaluateWalletAnchors(client),
  ]);

  const alerts: Array<{ entityDid: string; reason: string }> = [];
  const blocked: string[] = [];

  const persistPayload = [...issuers, ...employers, ...validators, ...wallets];
  await Promise.all(
    persistPayload.map((entry) =>
      client.trustAnchor.upsert({
        where: { entityDid: entry.entityDid },
        create: {
          entityDid: entry.entityDid,
          score: entry.score,
          metadata: entry.metadata,
        },
        update: {
          score: entry.score,
          metadata: entry.metadata,
        },
      }),
    ),
  );

  persistPayload.forEach((entry) => {
    if (entry.score < ALERT_THRESHOLD) {
      alerts.push({ entityDid: entry.entityDid, reason: 'score_below_threshold' });
    }
    if (entry.blocked) {
      blocked.push(entry.entityDid);
    }
    anchorTrustAnchorSnapshot({
      entityDid: entry.entityDid,
      entityType: entry.entityType,
      score: entry.score,
      contributingSignals: entry.metadata.contributions as Array<{ label: string; weight: number }>,
      alerts: entry.alerts,
    });
  });

  return {
    generatedAt: new Date().toISOString(),
    issuers,
    employers,
    validators,
    wallets,
    alerts,
    blockedEntities: blocked,
  } satisfies TrustAnchorSnapshot;
}

export async function getTrustAnchors(options: { prisma?: PrismaClient } = {}) {
  const client = (options.prisma ?? prisma) as ExtendedPrisma;
  const anchors = await client.trustAnchor.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
  return anchors.map((entry: any) => ({
    id: entry.id,
    entityDid: entry.entityDid,
    score: entry.score,
    metadata: entry.metadata ?? {},
    updatedAt: entry.updatedAt?.toISOString?.() ?? new Date().toISOString(),
  }));
}

async function evaluateIssuerAnchors(client: ExtendedPrisma): Promise<TrustAnchorScore[]> {
  const [issuers, indexRows, revocations, anchors] = await Promise.all([
    client.trustedIssuer.findMany({ take: 100 }),
    client.masterCredentialIndex.findMany({ take: 1000 }),
    client.masterCredentialIndex.findMany({ where: { status: 'revoked' }, take: 500 }),
    client.auditProof.findMany({ take: 200 }),
  ]);

  return issuers.map((issuer: any) => {
    const issued = indexRows.filter((row: any) => row.issuerDid === issuer.did);
    const revoked = revocations.filter((row: any) => row.issuerDid === issuer.did);
    const accuracy = issued.length ? 1 - revoked.length / issued.length : 0.5;
    const activityHours = issued.length
      ? differenceInHours(new Date(), new Date(issued[0].lastUpdated))
      : Infinity;
    const recencyScore = !Number.isFinite(activityHours) ? 0.4 : Math.max(0, 1 - activityHours / 720);
    const anchorCoverage =
      anchors.filter((proof: any) => proof.eventId?.includes?.(issuer.did)).length / Math.max(issued.length, 1);
    const normalizedAnchorCoverage = Math.min(1, anchorCoverage);

    const score = clampScore(accuracy * 0.5 + recencyScore * 0.2 + normalizedAnchorCoverage * 0.3);
    const blocked = score < ALERT_THRESHOLD - 0.1;

    return {
      id: issuer.id,
      entityDid: issuer.did,
      entityType: 'issuer' as const,
      score,
      blocked,
      metadata: {
        orgName: issuer.orgName,
        orgNpi: issuer.orgNpi,
        jurisdiction: issuer.jurisdiction,
        contributions: [
          { label: 'issuance_accuracy', weight: Number((accuracy * 0.5).toFixed(3)) },
          { label: 'recency', weight: Number((recencyScore * 0.2).toFixed(3)) },
          { label: 'audit_coverage', weight: Number((normalizedAnchorCoverage * 0.3).toFixed(3)) },
        ],
      },
      alerts: blocked ? ['auto_blocked'] : score < ALERT_THRESHOLD ? ['second_factor_required'] : [],
    };
  });
}

async function evaluateEmployerAnchors(client: ExtendedPrisma): Promise<TrustAnchorScore[]> {
  const [employers, hiringEvents] = await Promise.all([
    client.employerATS.findMany({ take: 100 }),
    client.hiringEvent.findMany({ take: 200 }),
  ]);

  if (!employers.length) return [];

  return employers.map((employer: any) => {
    const events = hiringEvents.filter((event: any) => event.employerId === employer.orgId);
    const verificationEvents = events.filter((event: any) => event.eventType === 'verified');
    const complianceEvents = events.filter((event: any) => event.metadata?.compliance === 'pass');
    const stabilityScore = Math.min(1, events.length / 25);
    const verificationAccuracy = verificationEvents.length
      ? complianceEvents.length / verificationEvents.length
      : 0.5;
    const score = clampScore(stabilityScore * 0.3 + verificationAccuracy * 0.7);

    return {
      id: employer.id,
      entityDid: `did:web:${employer.name ?? employer.orgId}.employer`,
      entityType: 'employer' as const,
      score,
      metadata: {
        orgId: employer.orgId,
        name: employer.name,
        contributions: [
          { label: 'verification_accuracy', weight: Number((verificationAccuracy * 0.7).toFixed(3)) },
          { label: 'workforce_stability', weight: Number((stabilityScore * 0.3).toFixed(3)) },
        ],
      },
      alerts: score < ALERT_THRESHOLD ? ['monitor_for_compliance'] : [],
      blocked: false,
    };
  });
}

async function evaluateValidatorAnchors(client: ExtendedPrisma): Promise<TrustAnchorScore[]> {
  const nodes = await client.chainHealth.findMany({ take: 100 });
  if (!nodes.length) return [];

  return nodes.map((node: any) => {
    const uptimeScore = node.synced ? 1 : 0.3;
    const latencyScore = node.latencyMs ? Math.max(0, 1 - node.latencyMs / 1200) : 0.5;
    const finalityScore = node.block
      ? Math.min(1, Number(node.block) / (Number(node.block) + 50))
      : 0.4;
    const score = clampScore(uptimeScore * 0.5 + latencyScore * 0.2 + finalityScore * 0.3);

    return {
      id: node.id,
      entityDid: `did:validator:${node.nodeId}`,
      entityType: 'validator' as const,
      score,
      metadata: {
        nodeId: node.nodeId,
        block: node.block,
        latencyMs: node.latencyMs,
        contributions: [
          { label: 'uptime', weight: Number((uptimeScore * 0.5).toFixed(3)) },
          { label: 'latency', weight: Number((latencyScore * 0.2).toFixed(3)) },
          { label: 'finality', weight: Number((finalityScore * 0.3).toFixed(3)) },
        ],
      },
      alerts: score < ALERT_THRESHOLD ? ['validator_health'] : [],
      blocked: score < ALERT_THRESHOLD - 0.2,
    };
  });
}

async function evaluateWalletAnchors(client: ExtendedPrisma): Promise<TrustAnchorScore[]> {
  const wallets = await client.walletProfile.findMany({ take: 200 });
  if (!wallets.length) return [];
  const devices = await client.walletDevice.findMany({ take: 300 });

  return wallets.map((wallet: any) => {
    const boundDevices = devices.filter((device: any) => device.clinicianId === wallet.clinicianId);
    const hasSecureEnclave = boundDevices.some(
      (device) => device.metadata?.secureEnclave === true || device.metadata?.platform === 'ios',
    );
    const passkeyScore = boundDevices.some((device) => device.metadata?.passkeyBound) ? 1 : 0.5;
    const sdJwtScore = wallet.walletType?.toLowerCase().includes('eudi') ? 1 : 0.6;

    const score = clampScore(
      (hasSecureEnclave ? 0.4 : 0.2) + passkeyScore * 0.3 + sdJwtScore * 0.3,
    );

    return {
      id: wallet.id,
      entityDid: `did:wallet:${wallet.walletType}:${wallet.clinicianId}`,
      entityType: 'wallet' as const,
      score,
      metadata: {
        clinicianId: wallet.clinicianId,
        walletType: wallet.walletType,
        contributions: [
          { label: 'secure_enclave', weight: Number(((hasSecureEnclave ? 0.4 : 0.2)).toFixed(3)) },
          { label: 'passkey_binding', weight: Number((passkeyScore * 0.3).toFixed(3)) },
          { label: 'sd_jwt_support', weight: Number((sdJwtScore * 0.3).toFixed(3)) },
        ],
      },
      alerts: score < ALERT_THRESHOLD ? ['wallet_hardening_required'] : [],
      blocked: false,
    };
  });
}

function clampScore(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

