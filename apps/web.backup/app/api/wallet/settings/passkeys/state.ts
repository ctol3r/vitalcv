"use server";

import { randomBytes } from 'node:crypto';

export interface RegisteredPasskey {
  id: string;
  clinicianId: string;
  name: string;
  transports: string[];
  createdAt: string;
  lastVerifiedAt?: string;
  attestation?: Record<string, unknown>;
}

export interface PasskeyChallenge {
  id: string;
  clinicianId: string;
  challenge: string;
  type: 'enroll' | 'verify';
  expiresAt: number;
  credentialId?: string;
}

const passkeyStore = new Map<string, RegisteredPasskey>();
const clinicianIndex = new Map<string, Set<string>>();
const challengeStore = new Map<string, PasskeyChallenge>();
const MAX_CHALLENGE_AGE_MS = 5 * 60 * 1000;

export function listPasskeys(clinicianId: string): RegisteredPasskey[] {
  const ids = clinicianIndex.get(clinicianId);
  if (!ids) return [];
  return Array.from(ids.values())
    .map((id) => passkeyStore.get(id))
    .filter((record): record is RegisteredPasskey => Boolean(record));
}

export function issueChallenge(
  clinicianId: string,
  type: PasskeyChallenge['type'],
  credentialId?: string,
): PasskeyChallenge {
  purgeChallenges();
  const challenge = randomBytes(32).toString('base64url');
  const record: PasskeyChallenge = {
    id: randomBytes(8).toString('hex'),
    clinicianId,
    type,
    challenge,
    credentialId,
    expiresAt: Date.now() + MAX_CHALLENGE_AGE_MS,
  };
  challengeStore.set(record.id, record);
  return record;
}

export function consumeChallenge(challengeId: string): PasskeyChallenge | null {
  purgeChallenges();
  const record = challengeStore.get(challengeId);
  if (!record) return null;
  challengeStore.delete(challengeId);
  return record;
}

export function savePasskey(record: RegisteredPasskey) {
  passkeyStore.set(record.id, record);
  if (!clinicianIndex.has(record.clinicianId)) {
    clinicianIndex.set(record.clinicianId, new Set());
  }
  clinicianIndex.get(record.clinicianId)!.add(record.id);
}

export function updateVerificationTimestamp(id: string) {
  const record = passkeyStore.get(id);
  if (!record) return;
  record.lastVerifiedAt = new Date().toISOString();
  passkeyStore.set(id, record);
}

export function isPasskeyRecentlyVerified(passkeyId: string, ttlMs = MAX_CHALLENGE_AGE_MS): boolean {
  const record = passkeyStore.get(passkeyId);
  if (!record?.lastVerifiedAt) return false;
  return Date.now() - Date.parse(record.lastVerifiedAt) <= ttlMs;
}

export function getPasskey(passkeyId: string): RegisteredPasskey | undefined {
  return passkeyStore.get(passkeyId);
}

function purgeChallenges() {
  const now = Date.now();
  for (const [id, record] of challengeStore.entries()) {
    if (record.expiresAt <= now) {
      challengeStore.delete(id);
    }
  }
}

