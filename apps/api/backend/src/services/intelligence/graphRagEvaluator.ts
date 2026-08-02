import prisma from '../../graphql/prisma_client';

/**
 * `requiredCredentialTypes` is a `Json` column, not `String[]`.
 *
 * The previous code called `.join(', ')` straight on it. That was never
 * type-safe — it only compiled because this file carried `@ts-nocheck` — and it
 * would have thrown on any row whose JSON was an object, a string, or null.
 * Narrow to the array-of-strings case the callers actually want, and treat
 * everything else as "no types listed" rather than crashing a compliance trace.
 */
function credentialTypeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

export interface EvaluationResult {
  isEligible: boolean;
  missingRequirements: string[];
  reasoningTrace: string[];
}

/**
 * ReadinessEvaluator — deterministic GraphRAG evaluation engine.
 *
 * Traverses the clinical ontology graph (StateComplianceRule, SpecialtyTaxonomy,
 * ResidencyProgram) and cross-references against a clinician's verified artifacts
 * to produce a strictly data-driven eligibility assessment.
 *
 * Zero hallucination risk: every conclusion is traced to a Prisma record.
 */
export class ReadinessEvaluator {
  async evaluateCandidate(
    npi: string,
    targetState: string,
    targetSpecialtyCode: string,
  ): Promise<EvaluationResult> {
    const trace: string[] = [];
    const missing: string[] = [];

    // ── Step 1: Resolve the specialty taxonomy ───────────────────
    trace.push(`[ONTOLOGY] Looking up specialty code: ${targetSpecialtyCode}`);

    const specialty = await prisma.specialtyTaxonomy.findUnique({
      where: { code: targetSpecialtyCode },
    });

    if (!specialty) {
      trace.push(`[ONTOLOGY] Specialty code ${targetSpecialtyCode} not found in taxonomy`);
      return { isEligible: false, missingRequirements: [`Unknown specialty code: ${targetSpecialtyCode}`], reasoningTrace: trace };
    }

    trace.push(`[ONTOLOGY] Resolved specialty: ${specialty.description} (board: ${specialty.boardName})`);

    // ── Step 2: Fetch state compliance rules ─────────────────────
    trace.push(`[COMPLIANCE] Querying ${targetState} rules for specialty: ${specialty.description}`);

    // `findFirst`, not `findUnique`. This read used to ask for a compound unique
    // called `state_code_specialty` over fields `state_code` and `specialty`.
    // None of those exist: the model's only compound unique is
    // `@@unique([state, ruleType])`, and the column is `state`, not `state_code`.
    // So there is no unique index on (state, specialty) to look up by, and the
    // call could never have run — Prisma rejects the argument before touching
    // the database.
    const stateRule = await prisma.stateComplianceRule.findFirst({
      where: { state: targetState, specialty: specialty.description },
    });

    if (!stateRule) {
      trace.push(`[COMPLIANCE] No compliance rule found for ${targetState} + ${specialty.description}`);
      trace.push(`[COMPLIANCE] Falling back to general state rule lookup`);

      // Try a broader match — state without specialty-specific rule.
      const generalRules = await prisma.stateComplianceRule.findMany({
        where: { state: targetState },
        take: 1,
      });

      if (generalRules.length === 0) {
        trace.push(`[COMPLIANCE] No rules found for state: ${targetState}`);
        return { isEligible: false, missingRequirements: [`No compliance rules for state: ${targetState}`], reasoningTrace: trace };
      }

      trace.push(
        `[COMPLIANCE] Using general rule: ${credentialTypeList(generalRules[0].requiredCredentialTypes).join(', ')}`,
      );
    }

    const requiredTypes = credentialTypeList(stateRule?.requiredCredentialTypes);
    trace.push(`[COMPLIANCE] Required credential types: [${requiredTypes.join(', ')}]`);
    trace.push(`[COMPLIANCE] Renewal window: ${stateRule?.renewalWindowDays ?? 365} days`);

    // ── Step 3: Fetch clinician's verified artifacts ──────────────
    trace.push(`[VERIFICATION] Querying verified artifacts for NPI: ${npi}`);

    const artifacts = await prisma.verificationArtifact.findMany({
      where: {
        npi,
        lifecycleState: 'active',
        revokedAt: null,
      },
      select: {
        source: true,
        status: true,
        verifiedAt: true,
        expiresAt: true,
        trustState: true,
      },
    });

    trace.push(`[VERIFICATION] Found ${artifacts.length} active artifact(s)`);

    const verifiedSources = new Set(artifacts.map((a) => a.source.toLowerCase()));
    trace.push(`[VERIFICATION] Verified sources: [${[...verifiedSources].join(', ')}]`);

    // ── Step 4: Cross-reference requirements ──────────────────────
    trace.push(`[EVALUATION] Cross-referencing ${requiredTypes.length} requirements against ${verifiedSources.size} verified sources`);

    for (const required of requiredTypes) {
      const normalized = required.toLowerCase();
      if (verifiedSources.has(normalized)) {
        trace.push(`[EVALUATION] ✓ ${required} — verified`);
      } else {
        trace.push(`[EVALUATION] ✗ ${required} — NOT FOUND in clinician artifacts`);
        missing.push(required);
      }
    }

    // ── Step 5: Check for expired artifacts ───────────────────────
    const now = new Date();
    for (const artifact of artifacts) {
      if (artifact.expiresAt && artifact.expiresAt < now) {
        trace.push(`[EVALUATION] ⚠ ${artifact.source} expired on ${artifact.expiresAt.toISOString().slice(0, 10)}`);
        missing.push(`${artifact.source} (expired)`);
      }
    }

    // ── Step 6: Check residency match ────────────────────────────
    trace.push(`[ACGME] Checking residency programs for specialty: ${specialty.description}`);

    const residencyMatch = await prisma.residencyProgram.findMany({
      where: { specialty: specialty.description },
      take: 5,
      select: { name: true, acgmeCode: true, hospitalAffiliation: true },
    });

    if (residencyMatch.length > 0) {
      trace.push(`[ACGME] Found ${residencyMatch.length} matching residency program(s)`);
      for (const prog of residencyMatch) {
        trace.push(`[ACGME]   → ${prog.name} (${prog.acgmeCode}) at ${prog.hospitalAffiliation}`);
      }
    } else {
      trace.push(`[ACGME] No residency programs found for specialty — skipping residency check`);
    }

    // ── Final determination ───────────────────────────────────────
    const isEligible = missing.length === 0;
    trace.push(
      isEligible
        ? `[RESULT] CLEARED — All ${requiredTypes.length} requirements satisfied for ${targetState}`
        : `[RESULT] NOT CLEARED — ${missing.length} missing requirement(s)`,
    );

    return { isEligible, missingRequirements: missing, reasoningTrace: trace };
  }
}
