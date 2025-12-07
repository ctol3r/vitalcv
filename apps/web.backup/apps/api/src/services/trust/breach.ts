import { PrismaClient } from '@prisma/client';
import { anchorTrustBreach } from '../audit/anchor';
import { setTrustWeight } from './weights';

const prisma = new PrismaClient();

const BREACH_DEDUP_WINDOW_MS = Number(process.env.TRUST_BREACH_DEDUP_WINDOW_MS ?? 6 * 60 * 60 * 1000);
const BREACH_BLACKLIST_THRESHOLD = Number(process.env.TRUST_BREACH_BLACKLIST_THRESHOLD ?? 3);
const REVOCATION_BREACH_THRESHOLD = Number(process.env.TRUST_REVOCATION_THRESHOLD ?? 0.2);
const INACTIVITY_BREACH_THRESHOLD = Number(process.env.TRUST_INACTIVITY_BREACH_THRESHOLD ?? 18);

interface BreachIncident {
  reason: string;
  detectedAt: string;
}

interface BreachState {
  count: number;
  incidents: BreachIncident[];
  lastDetectedAt: string;
  blacklisted: boolean;
}

const breachLedger = new Map<string, BreachState>();
const blacklistedIssuers = new Set<string>();

export interface TrustAnomalyContext {
  revocationRate?: number;
  monthsInactive?: number;
  requiresSecondFactor?: boolean;
}

export async function evaluateTrustAnomalies(issuerDid: string, context: TrustAnomalyContext): Promise<void> {
  const tasks: Promise<void>[] = [];
  if (context.revocationRate !== undefined && context.revocationRate > REVOCATION_BREACH_THRESHOLD) {
    tasks.push(recordTrustBreach(issuerDid, 'high_revocation_rate'));
  }
  if (context.monthsInactive !== undefined && context.monthsInactive > INACTIVITY_BREACH_THRESHOLD) {
    tasks.push(recordTrustBreach(issuerDid, 'issuer_inactive'));
  }
  if (context.requiresSecondFactor) {
    tasks.push(recordTrustBreach(issuerDid, 'requires_second_factor'));
  }

  await Promise.all(tasks);
}

export async function recordTrustBreach(issuerDid: string, reason: string): Promise<void> {
  const did = issuerDid.trim();
  if (!did) return;

  const now = Date.now();
  const isoNow = new Date(now).toISOString();
  const state = breachLedger.get(did) ?? {
    count: 0,
    incidents: [],
    lastDetectedAt: isoNow,
    blacklisted: false,
  };

  const duplicate = state.incidents.some(
    (incident) => incident.reason === reason && now - Date.parse(incident.detectedAt) < BREACH_DEDUP_WINDOW_MS,
  );
  if (duplicate) {
    return;
  }

  state.count += 1;
  state.lastDetectedAt = isoNow;
  state.incidents.unshift({ reason, detectedAt: isoNow });
  state.incidents = state.incidents.slice(0, 25);
  breachLedger.set(did, state);

  await anchorTrustBreach({
    issuerDid: did,
    reason,
  });

  if (state.count >= BREACH_BLACKLIST_THRESHOLD && !state.blacklisted) {
    await blacklistIssuer(did, reason);
    state.blacklisted = true;
  }
}

export function listTrustBreaches(): Array<{
  issuerDid: string;
  count: number;
  lastDetectedAt: string;
  reasons: string[];
  blacklisted: boolean;
}> {
  return Array.from(breachLedger.entries()).map(([issuerDid, state]) => ({
    issuerDid,
    count: state.count,
    lastDetectedAt: state.lastDetectedAt,
    reasons: state.incidents.map((incident) => incident.reason),
    blacklisted: state.blacklisted || blacklistedIssuers.has(issuerDid),
  }));
}

export function isIssuerBlacklisted(issuerDid: string): boolean {
  return blacklistedIssuers.has(issuerDid);
}

async function blacklistIssuer(issuerDid: string, reason: string) {
  blacklistedIssuers.add(issuerDid);
  await prisma.trustedIssuer
    .delete({
      where: { did: issuerDid },
    })
    .catch(() => null);
  await setTrustWeight(issuerDid, 0);
  console.warn(`[trust][blacklist] Issuer ${issuerDid} blacklisted after breach: ${reason}`);
}










