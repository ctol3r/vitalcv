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
  // TODO: removed - referenced non-existent Prisma models 'specialtyTaxonomy', 'stateComplianceRule', 'residencyProgram'
  // This evaluator cannot function without the ontology tables. Returns a
  // not-eligible result with an explanatory trace until the models are added.
  async evaluateCandidate(
    _npi: string,
    targetState: string,
    targetSpecialtyCode: string,
  ): Promise<EvaluationResult> {
    const trace: string[] = [
      `[ONTOLOGY] Looking up specialty code: ${targetSpecialtyCode}`,
      `[ONTOLOGY] Specialty taxonomy model unavailable — cannot resolve specialty`,
      `[COMPLIANCE] State compliance rule model unavailable — cannot evaluate ${targetState}`,
      `[ACGME] Residency program model unavailable — cannot cross-reference training`,
      `[RESULT] NOT CLEARED — ontology models not yet provisioned`,
    ];

    return {
      isEligible: false,
      missingRequirements: [
        `Ontology models (specialtyTaxonomy, stateComplianceRule, residencyProgram) not available`,
      ],
      reasoningTrace: trace,
    };
  }
}
