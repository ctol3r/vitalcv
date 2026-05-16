/**
 * complianceChaosSimulation.ts — W2-PR40A
 *
 * Pure-function chaos harness for the regulatory export pipeline. Given a
 * baseline manifest / packet / override-export, this module produces a set
 * of mutated copies under named chaos scenarios and re-validates them so a
 * test (or a regulator-side sanity check) can assert:
 *
 *   - Tampered evidence hashes are detected, never silently accepted.
 *   - Truncated audit streams produce visibly degraded coverage, not a
 *     "looks clean" manifest.
 *   - Cross-tenant entries injected into a manifest fail the contained-
 *     subject check (fail-closed semantics).
 *   - Out-of-window evidence shows up as `OUTSIDE_120_DAYS`, never silently
 *     reclassified as compliant.
 *
 * No prisma, no fetches. The harness operates entirely on already-built
 * regulatory-export documents. It MUTATES copies — never the originals.
 */
import { sha256ForPayload } from '../../../utils/deterministic';
import {
  buildNcqaExportManifest,
  type NcqaExportManifest,
  type BuildNcqaExportManifestInput,
} from './ncqaExportManifest';
import {
  buildOverrideAuditExport,
  type OverrideAuditExport,
  type BuildOverrideAuditExportInput,
} from './overrideAuditExport';

export type ComplianceChaosScenario =
  | 'BASELINE'
  | 'TAMPER_EVIDENCE_HASH'
  | 'TRUNCATE_SOURCES'
  | 'BACKDATE_RETRIEVAL_OUTSIDE_WINDOW'
  | 'INJECT_CROSS_TENANT_OVERRIDE'
  | 'STRIP_DECISION_LINEAGE'
  | 'DUPLICATE_OVERRIDE_REPLAY';

export interface ChaosVerdict {
  scenario: ComplianceChaosScenario;
  /** True when the simulation produced a regulator-visible signal — the
   *  whole point of fail-closed semantics. False means the chaos slipped
   *  through silently, which is a bug. */
  signalSurfaced: boolean;
  /** Human-readable note describing what surfaced (or didn't). */
  signal: string;
  /** Hash of the mutated manifest body, for transcript traceability. */
  mutatedHash: string | null;
}

export interface ComplianceChaosResult {
  scenario: ComplianceChaosScenario;
  verdict: ChaosVerdict;
}

function cloneInput<T>(input: T): T {
  return JSON.parse(JSON.stringify(input)) as T;
}

export function runNcqaManifestChaos(
  scenario: ComplianceChaosScenario,
  baseInput: BuildNcqaExportManifestInput,
): ChaosVerdict {
  if (scenario === 'BASELINE') {
    const m = buildNcqaExportManifest(baseInput);
    return {
      scenario,
      signalSurfaced: true,
      signal: `Baseline manifest produced with hash ${m.manifestHash.slice(0, 16)}...`,
      mutatedHash: m.manifestHash,
    };
  }

  if (scenario === 'TAMPER_EVIDENCE_HASH') {
    const mutated = cloneInput(baseInput);
    if (mutated.sources[0]) {
      mutated.sources[0].evidenceHash = 'f'.repeat(64);
    }
    const original = buildNcqaExportManifest(baseInput);
    const tampered = buildNcqaExportManifest(mutated);
    const surfaced = original.manifestHash !== tampered.manifestHash;
    return {
      scenario,
      signalSurfaced: surfaced,
      signal: surfaced
        ? 'Tampered evidence hash propagated into a different manifest hash — surfaced.'
        : 'CRITICAL: tampered evidence hash did not change the manifest hash.',
      mutatedHash: tampered.manifestHash,
    };
  }

  if (scenario === 'TRUNCATE_SOURCES') {
    const mutated = cloneInput(baseInput);
    mutated.sources = mutated.sources.slice(0, 1);
    const original = buildNcqaExportManifest(baseInput);
    const truncated = buildNcqaExportManifest(mutated);
    const baselineDirect = original.sectionCoverage.reduce(
      (acc, row) => acc + row.directEvidenceCount,
      0,
    );
    const truncatedDirect = truncated.sectionCoverage.reduce(
      (acc, row) => acc + row.directEvidenceCount,
      0,
    );
    const surfaced =
      truncatedDirect < baselineDirect || truncated.manifestHash !== original.manifestHash;
    return {
      scenario,
      signalSurfaced: surfaced,
      signal: surfaced
        ? `Truncated source set reduced direct-evidence count from ${baselineDirect} to ${truncatedDirect}.`
        : 'CRITICAL: source truncation produced an identical manifest — coverage drop was invisible.',
      mutatedHash: truncated.manifestHash,
    };
  }

  if (scenario === 'BACKDATE_RETRIEVAL_OUTSIDE_WINDOW') {
    const mutated = cloneInput(baseInput);
    const targetSourceName = mutated.sources[0]?.source ?? null;
    if (mutated.sources[0] && mutated.decisionTimestamp) {
      const decisionMs = Date.parse(mutated.decisionTimestamp);
      mutated.sources[0].retrievedAt = new Date(decisionMs - 200 * 24 * 60 * 60 * 1000).toISOString();
    }
    const m = buildNcqaExportManifest(mutated);
    // The manifest sorts sources alphabetically; look the backdated source up
    // by name rather than relying on input order.
    const target = targetSourceName
      ? m.sources.find((s) => s.source === targetSourceName) ?? null
      : null;
    const surfaced = target?.timeliness === 'OUTSIDE_120_DAYS';
    return {
      scenario,
      signalSurfaced: surfaced,
      signal: surfaced
        ? `Out-of-window retrieval flagged as OUTSIDE_120_DAYS (days=${target?.daysBeforeDecision}).`
        : 'CRITICAL: out-of-window retrieval did not flip the timeliness verdict.',
      mutatedHash: m.manifestHash,
    };
  }

  if (scenario === 'STRIP_DECISION_LINEAGE') {
    const mutated = cloneInput(baseInput);
    mutated.decisions = [];
    const m = buildNcqaExportManifest(mutated);
    const cr5 = m.sectionCoverage.find(
      (row) => row.standard.standardId === 'NCQA_CR_5_CREDENTIALING_COMMITTEE',
    );
    const ambiguityFlagged = m.ambiguities.some((n) => n.field === 'decisions');
    const surfaced = (cr5?.directEvidenceCount ?? 0) === 0 && ambiguityFlagged;
    return {
      scenario,
      signalSurfaced: surfaced,
      signal: surfaced
        ? 'Decision lineage stripped — CR 5 coverage dropped to zero AND ambiguity note was emitted.'
        : 'CRITICAL: decision-lineage strip did not reduce CR 5 coverage and/or did not surface as ambiguity.',
      mutatedHash: m.manifestHash,
    };
  }

  return {
    scenario,
    signalSurfaced: false,
    signal: `Scenario ${scenario} is not applicable to NCQA manifest chaos.`,
    mutatedHash: null,
  };
}

export function runOverrideExportChaos(
  scenario: ComplianceChaosScenario,
  baseInput: BuildOverrideAuditExportInput,
): ChaosVerdict {
  if (scenario === 'BASELINE') {
    const exp = buildOverrideAuditExport(baseInput);
    return {
      scenario,
      signalSurfaced: true,
      signal: `Baseline override export produced with hash ${exp.exportHash.slice(0, 16)}... (${exp.summary.totalOverrides} entries).`,
      mutatedHash: exp.exportHash,
    };
  }

  if (scenario === 'INJECT_CROSS_TENANT_OVERRIDE') {
    const original = buildOverrideAuditExport(baseInput);
    const mutated = cloneInput(baseInput);
    const filterEntity = baseInput.filter?.entityId ?? null;
    if (!filterEntity) {
      // Without a filter the chaos is a no-op; surface the signal as not-applicable.
      return {
        scenario,
        signalSurfaced: false,
        signal: 'No filter.entityId supplied; cross-tenant injection is not exercisable.',
        mutatedHash: null,
      };
    }
    mutated.entries = [
      ...mutated.entries,
      {
        ...mutated.entries[0],
        auditEventId: `cross-tenant-${mutated.entries[0]?.auditEventId ?? 'x'}`,
        entityId: 'OTHER_TENANT_ENTITY',
        clinicianNpi: '9999999999',
        actorId: 'cross-tenant-actor',
      } as (typeof mutated.entries)[number],
    ];
    const tampered = buildOverrideAuditExport(mutated);
    // The filter MUST drop the cross-tenant entry — the export's totalOverrides
    // should equal the original.
    const surfaced =
      tampered.summary.totalOverrides === original.summary.totalOverrides &&
      !tampered.entries.some((e) => e.entityId === 'OTHER_TENANT_ENTITY');
    return {
      scenario,
      signalSurfaced: surfaced,
      signal: surfaced
        ? 'Cross-tenant override injection was filtered out by the export entity filter (fail-closed).'
        : 'CRITICAL: cross-tenant override survived the export entity filter.',
      mutatedHash: tampered.exportHash,
    };
  }

  if (scenario === 'DUPLICATE_OVERRIDE_REPLAY') {
    const original = buildOverrideAuditExport(baseInput);
    const mutated = cloneInput(baseInput);
    if (mutated.entries[0]) {
      mutated.entries = [...mutated.entries, mutated.entries[0]];
    }
    const tampered = buildOverrideAuditExport(mutated);
    const surfaced =
      tampered.summary.totalOverrides === original.summary.totalOverrides + 1 &&
      tampered.exportHash !== original.exportHash;
    return {
      scenario,
      signalSurfaced: surfaced,
      signal: surfaced
        ? 'Duplicate override entry inflated total count and changed export hash — surfaced.'
        : 'CRITICAL: duplicate override entry produced an identical export hash.',
      mutatedHash: tampered.exportHash,
    };
  }

  return {
    scenario,
    signalSurfaced: false,
    signal: `Scenario ${scenario} is not applicable to override-export chaos.`,
    mutatedHash: null,
  };
}

export function summarizeChaos(verdicts: ChaosVerdict[]): {
  totalScenarios: number;
  surfacedCount: number;
  silentCount: number;
  digest: string;
} {
  return {
    totalScenarios: verdicts.length,
    surfacedCount: verdicts.filter((v) => v.signalSurfaced).length,
    silentCount: verdicts.filter((v) => !v.signalSurfaced).length,
    digest: sha256ForPayload(
      verdicts.map((v) => ({
        scenario: v.scenario,
        signalSurfaced: v.signalSurfaced,
        mutatedHash: v.mutatedHash,
      })),
    ),
  };
}

export function isManifestNonEmpty(input: NcqaExportManifest): boolean {
  return input.sources.length > 0 || input.decisions.length > 0 || input.overrides.length > 0;
}

export function isOverrideExportNonEmpty(input: OverrideAuditExport): boolean {
  return input.summary.totalOverrides > 0;
}
