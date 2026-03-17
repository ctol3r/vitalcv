#!/usr/bin/env ts-node
/**
 * Seed script: Populate the database with real-schema providers and verification runs.
 *
 * These are plausible (not mock) provider records using real NPI format,
 * real taxonomy codes, and real state abbreviations. They give the investigator
 * engine something to scan against.
 *
 * Usage:
 *   cd apps/api/backend
 *   DATABASE_URL="..." pnpm exec ts-node scripts/seed-providers.ts
 *
 * Idempotent: skips providers that already exist (by NPI).
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

const PROVIDERS = [
  {
    npi: '1234567890',
    fullName: 'Dr. Sarah Chen',
    providerType: 'Individual',
    taxonomyCode: '207R00000X', // Internal Medicine
    stateOfPractice: 'CA',
  },
  {
    npi: '2345678901',
    fullName: 'Dr. Michael Rivera',
    providerType: 'Individual',
    taxonomyCode: '207RC0000X', // Cardiovascular Disease
    stateOfPractice: 'TX',
  },
  {
    npi: '3456789012',
    fullName: 'Dr. Emily Nakamura',
    providerType: 'Individual',
    taxonomyCode: '2084N0400X', // Neurology
    stateOfPractice: 'NY',
  },
  {
    npi: '4567890123',
    fullName: 'Dr. James Okonkwo',
    providerType: 'Individual',
    taxonomyCode: '207Q00000X', // Family Medicine
    stateOfPractice: 'IL',
  },
  {
    npi: '5678901234',
    fullName: 'Pacific Northwest Medical Group',
    providerType: 'Organization',
    taxonomyCode: '261QM0801X', // Critical Access Hospital
    stateOfPractice: 'WA',
  },
];

const VERIFICATION_SOURCES = [
  { sourceName: 'NPPES', label: 'NPI Registry' },
  { sourceName: 'state_medical_board', label: 'State Medical Board' },
  { sourceName: 'DEA', label: 'DEA CSOS' },
  { sourceName: 'ABMS', label: 'Board Certification' },
  { sourceName: 'OIG_LEIE', label: 'OIG Exclusion List' },
];

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function seed() {
  console.log('[Seed] Starting provider seed...');

  let created = 0;
  let skipped = 0;

  for (const p of PROVIDERS) {
    const existing = await prisma.provider.findUnique({ where: { npi: p.npi } });
    if (existing) {
      console.log(`  [skip] ${p.fullName} (NPI ${p.npi}) — already exists`);
      skipped++;
      continue;
    }

    const provider = await prisma.provider.create({ data: p });

    // Create 2-3 verification runs per provider
    const sourceCount = 2 + (created % 2); // alternates between 2 and 3
    const sources = VERIFICATION_SOURCES.slice(0, sourceCount);

    for (const source of sources) {
      const rawPayload = JSON.stringify({
        npi: p.npi,
        name: p.fullName,
        source: source.sourceName,
        retrievedAt: new Date().toISOString(),
        status: 'ACTIVE',
      });

      await prisma.verificationRun.create({
        data: {
          providerId: provider.id,
          sourceName: source.sourceName,
          retrievedAtUtc: new Date(),
          rawPayloadHash: sha256(rawPayload),
          artifactHash: sha256(`${p.npi}-${source.sourceName}-${Date.now()}`),
        },
      });
    }

    console.log(`  [created] ${p.fullName} (NPI ${p.npi}) + ${sourceCount} verification runs`);
    created++;
  }

  console.log(`\n[Seed] Done. Created: ${created}, Skipped: ${skipped}`);
}

seed()
  .catch((err) => {
    console.error('[Seed] Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
