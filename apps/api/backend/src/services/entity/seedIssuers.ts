/**
 * seedIssuers.ts — Canonical issuer entity seeding
 *
 * Seeds VcvEntity records for the authoritative sources that VCV trusts.
 * These are the "issuers" that credentials reference via issuerId.
 *
 * Canonical ID pattern: `ISSUER:{sourceId}`
 * This ensures idempotent upsert and cross-reference by sourceId.
 *
 * Sources seeded here must match the sourceId values in sourceCatalog.ts.
 * Called once at backend startup (app.ts).
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

interface IssuerSeed {
  canonicalId:   string;   // `ISSUER:{sourceId}` — deterministic
  displayName:   string;
  npi?:          string;
  specialty:     string;
  status:        string;
  website?:      string;
}

const ISSUERS: IssuerSeed[] = [
  {
    canonicalId:  'ISSUER:NPPES_API',
    displayName:  'CMS National Plan and Provider Enumeration System (NPPES)',
    specialty:    'Federal NPI Registry',
    status:       'ACTIVE',
    website:      'https://npiregistry.cms.hhs.gov',
  },
  {
    canonicalId:  'ISSUER:NPPES_BULK',
    displayName:  'CMS NPPES Bulk Data',
    specialty:    'Federal NPI Registry (Bulk)',
    status:       'ACTIVE',
    website:      'https://download.cms.gov/nppes',
  },
  {
    canonicalId:  'ISSUER:OIG_LEIE',
    displayName:  'HHS Office of Inspector General — List of Excluded Individuals/Entities',
    specialty:    'Federal Exclusion Registry',
    status:       'ACTIVE',
    website:      'https://oig.hhs.gov/exclusions',
  },
  {
    canonicalId:  'ISSUER:PECOS_PUBLIC',
    displayName:  'CMS Provider Enrollment, Chain and Ownership System (PECOS)',
    specialty:    'Medicare Enrollment Registry',
    status:       'ACTIVE',
    website:      'https://pecos.cms.hhs.gov',
  },
  {
    canonicalId:  'ISSUER:DOCTORS_CLINICIANS',
    displayName:  'CMS Doctors and Clinicians National Downloadable File',
    specialty:    'Medicare Provider Directory',
    status:       'ACTIVE',
    website:      'https://data.cms.gov/provider-data',
  },
  {
    canonicalId:  'ISSUER:NURSYS',
    displayName:  'Nursys — National Nursing Licensure Database',
    specialty:    'Nursing Licensure Registry',
    status:       'ACTIVE',
    website:      'https://www.nursys.com',
  },
  {
    canonicalId:  'ISSUER:DEA',
    displayName:  'Drug Enforcement Administration — Controlled Substance Registration',
    specialty:    'Federal DEA Registration',
    status:       'ACTIVE',
    website:      'https://www.deadiversion.usdoj.gov',
  },
  {
    canonicalId:  'ISSUER:SAM_GOV',
    displayName:  'SAM.gov — System for Award Management',
    specialty:    'Federal Debarment Registry',
    status:       'ACTIVE',
    website:      'https://sam.gov',
  },
  {
    canonicalId:  'ISSUER:ACGME',
    displayName:  'Accreditation Council for Graduate Medical Education (ACGME)',
    specialty:    'Residency & Fellowship Accreditation',
    status:       'ACTIVE',
    website:      'https://www.acgme.org',
  },
  {
    canonicalId:  'ISSUER:LCME',
    displayName:  'Liaison Committee on Medical Education (LCME)',
    specialty:    'Medical School Accreditation',
    status:       'ACTIVE',
    website:      'https://lcme.org',
  },
  {
    canonicalId:  'ISSUER:CAQH',
    displayName:  'Council for Affordable Quality Healthcare (CAQH)',
    specialty:    'Provider Credentialing Database',
    status:       'ACTIVE',
    website:      'https://www.caqh.org',
  },
];

let seeded = false;

export async function seedIssuerEntities(): Promise<void> {
  if (seeded) return;

  let created = 0;
  let skipped = 0;

  for (const issuer of ISSUERS) {
    try {
      const existing = await prisma.vcvEntity.findUnique({
        where:  { canonicalId: issuer.canonicalId },
        select: { id: true },
      });

      if (!existing) {
        await prisma.vcvEntity.create({
          data: {
            canonicalId:  issuer.canonicalId,
            entityType:   'ORGANIZATION',
            displayName:  issuer.displayName,
            sourceIds:    ['INTERNAL_SEED'],
            verifiedAt:   new Date(),
            metadata: {
              specialty: issuer.specialty,
              status:    issuer.status,
              website:   issuer.website,
              isIssuer:  true,
            } as import('@prisma/client').Prisma.InputJsonValue,
          },
        });
        created++;
      } else {
        skipped++;
      }
    } catch (err) {
      log('warn', 'issuer_seed_failed', { canonicalId: issuer.canonicalId, error: String(err) });
    }
  }

  seeded = true;
  log('info', 'issuers_seeded', { created, skipped, total: ISSUERS.length });
}
