import { randomUUID } from 'crypto';

import { ChainClient, type ChainReceipt } from '../chain/client';

const chainClient = new ChainClient();

export type ThreatSignature =
  | 'credential_stuffing'
  | 'bot_burst'
  | 'dpop_replay';

export interface RequestLogEntry {
  ip: string;
  path: string;
  method: string;
  subjectId?: string;
  success: boolean;
  timestamp: string | number | Date;
  dpopJkt?: string;
}

export interface ThreatFinding {
  id: string;
  signature: ThreatSignature;
  severity: 'low' | 'medium' | 'high';
  actors: string[];
  sample: RequestLogEntry[];
  anchoredAt?: ChainReceipt;
}

export interface ScanOptions {
  lookbackMinutes?: number;
  stuffingThreshold?: number;
  burstThreshold?: number;
}

export async function scanThreatSignatures(
  entries: RequestLogEntry[],
  options: ScanOptions = {},
): Promise<ThreatFinding[]> {
  if (!entries.length) {
    return [];
  }

  const normalized = normalizeEntries(entries, options.lookbackMinutes ?? 30);
  const findings: ThreatFinding[] = [];

  findings.push(...detectCredentialStuffing(normalized, options.stuffingThreshold ?? 8));
  findings.push(...detectBotBursts(normalized, options.burstThreshold ?? 45));
  findings.push(...detectDpopReplays(normalized));

  for (const finding of findings) {
    finding.anchoredAt = await chainClient.submitAuditEvent({
      eventType: `threat:${finding.signature}`,
      payload: {
        actors: finding.actors,
        severity: finding.severity,
        sample: finding.sample.slice(0, 5),
      },
      tags: ['security', 'threat'],
    });
  }

  return findings;
}

function detectCredentialStuffing(
  entries: RequestLogEntry[],
  threshold: number,
): ThreatFinding[] {
  const grouped = new Map<string, RequestLogEntry[]>();
  entries
    .filter((entry) => !entry.success)
    .forEach((entry) => {
      const bucket = grouped.get(entry.ip) ?? [];
      bucket.push(entry);
      grouped.set(entry.ip, bucket);
    });

  const findings: ThreatFinding[] = [];
  for (const [ip, attempts] of grouped.entries()) {
    const uniqueSubjects = new Set(
      attempts.map((attempt) => attempt.subjectId ?? `anon:${attempt.path}`),
    );
    if (attempts.length >= threshold && uniqueSubjects.size >= Math.min(3, threshold / 2)) {
      findings.push({
        id: randomUUID(),
        signature: 'credential_stuffing',
        severity: attempts.length > threshold * 1.5 ? 'high' : 'medium',
        actors: [ip],
        sample: attempts.slice(0, 10),
      });
    }
  }
  return findings;
}

function detectBotBursts(
  entries: RequestLogEntry[],
  threshold: number,
): ThreatFinding[] {
  const window = 60 * 1000; // 1 minute
  const grouped = new Map<string, RequestLogEntry[]>();
  entries.forEach((entry) => {
    const bucket = grouped.get(entry.ip) ?? [];
    bucket.push(entry);
    grouped.set(entry.ip, bucket);
  });

  const findings: ThreatFinding[] = [];
  for (const [ip, bucket] of grouped.entries()) {
    bucket.sort((a, b) => +a.timestamp - +b.timestamp);
    for (let i = 0; i < bucket.length; i += 1) {
      let count = 1;
      for (let j = i + 1; j < bucket.length; j += 1) {
        if (+bucket[j].timestamp - +bucket[i].timestamp <= window) {
          count += 1;
        } else {
          break;
        }
      }
      if (count >= threshold) {
        findings.push({
          id: randomUUID(),
          signature: 'bot_burst',
          severity: count > threshold * 1.5 ? 'high' : 'medium',
          actors: [ip],
          sample: bucket.slice(i, i + count),
        });
        break;
      }
    }
  }
  return findings;
}

function detectDpopReplays(entries: RequestLogEntry[]): ThreatFinding[] {
  const grouped = new Map<string, RequestLogEntry[]>();
  entries
    .filter((entry) => entry.dpopJkt)
    .forEach((entry) => {
      const bucket = grouped.get(entry.dpopJkt!) ?? [];
      bucket.push(entry);
      grouped.set(entry.dpopJkt!, bucket);
    });

  const findings: ThreatFinding[] = [];
  for (const [thumbprint, bucket] of grouped.entries()) {
    if (bucket.length < 3) continue;
    const uniqueIps = new Set(bucket.map((entry) => entry.ip));
    if (uniqueIps.size >= 2) {
      findings.push({
        id: randomUUID(),
        signature: 'dpop_replay',
        severity: 'high',
        actors: Array.from(uniqueIps),
        sample: bucket.slice(0, 10),
      });
    }
  }
  return findings;
}

function normalizeEntries(entries: RequestLogEntry[], windowMinutes: number): RequestLogEntry[] {
  const cutoff = Date.now() - windowMinutes * 60 * 1000;
  return entries
    .map((entry) => ({
      ...entry,
      timestamp:
        entry.timestamp instanceof Date
          ? entry.timestamp.getTime()
          : typeof entry.timestamp === 'string'
            ? new Date(entry.timestamp).getTime()
            : Number(entry.timestamp),
    }))
    .filter((entry) => Number.isFinite(entry.timestamp) && entry.timestamp >= cutoff);
}

