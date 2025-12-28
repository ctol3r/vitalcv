import { PrismaClient } from '@prisma/client';
import { getActiveStates } from './compactGraph.js';
import type { CompactType } from './models/CompactParticipation.js';
import { normalizeStateCode } from './models/CompactParticipation.js';

const prisma = new PrismaClient();

export interface CompactRecognitionResult {
  compactId: CompactType;
  memberState: string;
  recognizedStates: string[];
}

const DEFAULT_RECOGNIZED_DID_PREFIX = 'did:example:state:';

export function getCompactRecognizedStates(
  compactId: CompactType,
  memberState: string
): string[] {
  const normalizedMember = normalizeStateCode(memberState);
  const activeStates = getActiveStates(compactId);
  return activeStates.filter((state) => state !== normalizedMember);
}

export function isCompactPortabilityMatch(
  compactId: CompactType,
  memberState: string,
  requiredState: string
): boolean {
  const normalizedRequired = normalizeStateCode(requiredState);
  return getCompactRecognizedStates(compactId, memberState).includes(normalizedRequired);
}

export async function recordCompactRecognition(
  compactId: CompactType,
  memberState: string,
  issuerDid: string,
  recognizedStates?: string[]
): Promise<CompactRecognitionResult> {
  const normalizedMember = normalizeStateCode(memberState);
  const recognized =
    recognizedStates?.map(normalizeStateCode) ?? getCompactRecognizedStates(compactId, normalizedMember);

  const records = recognized.map((state) => ({
    compactId,
    memberState: normalizedMember,
    issuerDid,
    recognizedDid: `${DEFAULT_RECOGNIZED_DID_PREFIX}${state.toLowerCase()}`,
  }));

  for (const record of records) {
    await prisma.licenseCompact.upsert({
      where: {
        compactId_memberState_issuerDid_recognizedDid: {
          compactId: record.compactId,
          memberState: record.memberState,
          issuerDid: record.issuerDid,
          recognizedDid: record.recognizedDid,
        },
      },
      update: {},
      create: record,
    });
  }

  return {
    compactId,
    memberState: normalizedMember,
    recognizedStates: recognized,
  };
}
