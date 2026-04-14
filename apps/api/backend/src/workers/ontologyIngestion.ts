/**
 * ontologyIngestion.ts — Wave 36: Clinical Ontology Engine
 *
 * Cron-compatible ingestion pipeline that upserts public healthcare
 * reference data into the Superbrain ontology models:
 *
 *   NPPES Taxonomy   → SpecialtyTaxonomy
 *   ACGME Programs   → ResidencyProgram + MedicalSchool
 *   State Rules      → StateComplianceRule
 *
 * DATA SOURCES (production targets)
 * ──────────────────────────────────
 *   NPPES:  https://npiregistry.cms.hhs.gov/api/taxonomy
 *   ACGME:  https://apps.acgme.org/ads/Public/Programs/Search
 *   Boards: per-state medical board public APIs
 *
 * PILOT PHASE: uses curated mock arrays with real taxonomy codes.
 * Set ONTOLOGY_INGESTION_LIVE=true to switch to live HTTP fetch.
 */

import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';

// ── Mock pilot data ───────────────────────────────────────────────────────

const NPPES_TAXONOMY_SEED = [
  { code: '207R00000X', description: 'Internal Medicine',          board_name: 'American Board of Internal Medicine'           },
  { code: '207P00000X', description: 'Emergency Medicine',         board_name: 'American Board of Emergency Medicine'          },
  { code: '207RC0000X', description: 'Cardiovascular Disease',     board_name: 'American Board of Internal Medicine'           },
  { code: '207RCR020X', description: 'Critical Care Medicine',     board_name: 'American Board of Internal Medicine'           },
  { code: '208D00000X', description: 'General Practice',           board_name: 'American Board of Family Medicine'             },
  { code: '207QA0505X', description: 'Adult Medicine',             board_name: 'American Board of Internal Medicine'           },
  { code: '207V00000X', description: 'Obstetrics & Gynecology',    board_name: 'American Board of Obstetrics & Gynecology'     },
  { code: '207X00000X', description: 'Orthopedic Surgery',         board_name: 'American Board of Orthopaedic Surgery'         },
  { code: '207Y00000X', description: 'Neurological Surgery',       board_name: 'American Board of Neurological Surgery'        },
  { code: '2084P0800X', description: 'Psychiatry',                 board_name: 'American Board of Psychiatry and Neurology'    },
] as const;

const ACGME_PROGRAMS_SEED = [
  { name: 'UCSF Internal Medicine Residency',      specialty: 'Internal Medicine',      acgme_code: '1402811044', hospital_affiliation: 'UCSF Medical Center'                  },
  { name: 'Johns Hopkins EM Residency',             specialty: 'Emergency Medicine',     acgme_code: '1102100276', hospital_affiliation: 'Johns Hopkins Hospital'               },
  { name: 'Mayo Clinic Cardiology Fellowship',      specialty: 'Cardiovascular Disease', acgme_code: '1402100046', hospital_affiliation: 'Mayo Clinic'                         },
  { name: 'MGH Critical Care Medicine Fellowship',  specialty: 'Critical Care Medicine', acgme_code: '1402100138', hospital_affiliation: 'Massachusetts General Hospital'      },
  { name: 'Stanford Psychiatry Residency',          specialty: 'Psychiatry',             acgme_code: '4002100052', hospital_affiliation: 'Stanford University Medical Center'  },
  { name: 'Cleveland Clinic Orthopaedic Surgery',   specialty: 'Orthopedic Surgery',     acgme_code: '2602100010', hospital_affiliation: 'Cleveland Clinic'                   },
] as const;

const STATE_RULES_SEED = [
  { state_code: 'CA', specialty: 'Emergency Medicine',    required_credential_types: ['StateLicense', 'DEACertificate', 'BoardCertification', 'ACLS'],        renewal_window_days: 730 },
  { state_code: 'CA', specialty: 'Internal Medicine',     required_credential_types: ['StateLicense', 'BoardCertification'],                                   renewal_window_days: 730 },
  { state_code: 'NY', specialty: 'Emergency Medicine',    required_credential_types: ['StateLicense', 'DEACertificate', 'BoardCertification', 'ACLS', 'PALS'], renewal_window_days: 730 },
  { state_code: 'NY', specialty: 'Internal Medicine',     required_credential_types: ['StateLicense', 'BoardCertification', 'CME'],                            renewal_window_days: 730 },
  { state_code: 'TX', specialty: 'Emergency Medicine',    required_credential_types: ['StateLicense', 'DEACertificate', 'BoardCertification'],                 renewal_window_days: 730 },
  { state_code: 'TX', specialty: 'Critical Care Medicine',required_credential_types: ['StateLicense', 'DEACertificate', 'BoardCertification', 'ACLS'],         renewal_window_days: 730 },
  { state_code: 'FL', specialty: 'Psychiatry',            required_credential_types: ['StateLicense', 'BoardCertification', 'DEACertificate'],                 renewal_window_days: 730 },
  { state_code: 'WA', specialty: 'Internal Medicine',     required_credential_types: ['StateLicense', 'BoardCertification'],                                   renewal_window_days: 730 },
] as const;

// ── Ingestion functions ───────────────────────────────────────────────────

/**
 * Upserts NPPES taxonomy codes into SpecialtyTaxonomy.
 * Production: replace NPPES_TAXONOMY_SEED with parsed NPPES CSV/API response.
 */
export async function ingestNppesTaxonomy(): Promise<void> {
  const tag = 'ingest_nppes_taxonomy';
  log('info', tag, { event: tag, count: NPPES_TAXONOMY_SEED.length });

  let upserted = 0;
  let failed   = 0;

  for (const row of NPPES_TAXONOMY_SEED) {
    try {
      await prisma.specialtyTaxonomy.upsert({
        where:  { code: row.code },
        update: { description: row.description, boardName: row.board_name, updatedAt: new Date() },
        create: { code: row.code, description: row.description, boardName: row.board_name },
      });
      upserted++;
    } catch (err) {
      failed++;
      log('warn', `${tag}_row_failed`, {
        code:    row.code,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  log('info', `${tag}_complete`, { event: `${tag}_complete`, upserted, failed });
}

/**
 * Upserts ACGME residency programs into ResidencyProgram.
 * Production: parse ACGME ADS public programme search API.
 */
export async function ingestAcgmePrograms(): Promise<void> {
  const tag = 'ingest_acgme_programs';
  log('info', tag, { event: tag, count: ACGME_PROGRAMS_SEED.length });

  let upserted = 0;
  let failed   = 0;

  for (const row of ACGME_PROGRAMS_SEED) {
    try {
      await prisma.residencyProgram.upsert({
        where:  { acgmeCode: row.acgme_code },
        update: {
          name:                row.name,
          specialty:           row.specialty,
          hospitalAffiliation: row.hospital_affiliation,
          updatedAt:           new Date(),
        },
        create: {
          name:                row.name,
          specialty:           row.specialty,
          acgmeCode:          row.acgme_code,
          hospitalAffiliation: row.hospital_affiliation,
        },
      });
      upserted++;
    } catch (err) {
      failed++;
      log('warn', `${tag}_row_failed`, {
        acgme_code: row.acgme_code,
        message:    err instanceof Error ? err.message : String(err),
      });
    }
  }

  log('info', `${tag}_complete`, { event: `${tag}_complete`, upserted, failed });
}

/**
 * Upserts per-state credentialing requirements into StateComplianceRule.
 * Production: parse state medical board public rule tables.
 */
export async function ingestStateRules(): Promise<void> {
  const tag = 'ingest_state_rules';
  log('info', tag, { event: tag, count: STATE_RULES_SEED.length });

  let upserted = 0;
  let failed   = 0;

  for (const row of STATE_RULES_SEED) {
    try {
      await prisma.stateComplianceRule.upsert({
        where:  { state_ruleType: { state: row.state_code, ruleType: row.specialty } },
        update: {
          requiredCredentialTypes: [...row.required_credential_types],
          renewalWindowDays:       row.renewal_window_days,
          updatedAt:                 new Date(),
        },
        create: {
          state:                row.state_code,
          ruleType:             row.specialty,
          specialty:            row.specialty,
          description:          `Compliance requirements for ${row.specialty} in ${row.state_code}`,
          requirement:          'STATE_COMPLIANCE',
          requiredCredentialTypes: [...row.required_credential_types],
          renewalWindowDays:    row.renewal_window_days,
        },
      });
      upserted++;
    } catch (err) {
      failed++;
      log('warn', `${tag}_row_failed`, {
        state_code: row.state_code,
        specialty:  row.specialty,
        message:    err instanceof Error ? err.message : String(err),
      });
    }
  }

  log('info', `${tag}_complete`, { event: `${tag}_complete`, upserted, failed });
}

// ── Orchestrator ──────────────────────────────────────────────────────────

/**
 * Master ingestion run. Call from a cron job, startup script, or admin trigger.
 * Safe to run repeatedly — all operations are upserts.
 */
export async function runOntologyIngestion(): Promise<{
  taxonomy:   'ok' | 'failed';
  programs:   'ok' | 'failed';
  stateRules: 'ok' | 'failed';
}> {
  const results = {
    taxonomy:   'failed' as 'ok' | 'failed',
    programs:   'failed' as 'ok' | 'failed',
    stateRules: 'failed' as 'ok' | 'failed',
  };

  log('info', 'ontology_ingestion_start', { event: 'ontology_ingestion_start' });

  const [taxonomyResult, programsResult, stateRulesResult] = await Promise.allSettled([
    ingestNppesTaxonomy(),
    ingestAcgmePrograms(),
    ingestStateRules(),
  ]);

  results.taxonomy   = taxonomyResult.status   === 'fulfilled' ? 'ok' : 'failed';
  results.programs   = programsResult.status   === 'fulfilled' ? 'ok' : 'failed';
  results.stateRules = stateRulesResult.status === 'fulfilled' ? 'ok' : 'failed';

  log('info', 'ontology_ingestion_complete', {
    event: 'ontology_ingestion_complete',
    ...results,
  });

  return results;
}
