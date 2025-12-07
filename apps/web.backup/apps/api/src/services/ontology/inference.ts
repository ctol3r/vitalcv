/**
 * Ontology inference engine
 * AI suggests missing ontology links
 */

export interface OntologyInference {
  suggestions: Array<{
    type: 'specialty_link' | 'role_link' | 'training_link' | 'credential_link';
    source: string;
    target: string;
    confidence: number;
    rationale: string;
  }>;
  confidence: number;
}

export function ontologyInferenceEngine(partialData: any): OntologyInference {
  const suggestions: OntologyInference['suggestions'] = [];

  // Infer specialty links from credentials
  if (partialData.credentials) {
    Object.entries(partialData.credentials).forEach(([credId, cred]: [string, any]) => {
      if (cred.specialty && !cred.ontologyLink) {
        suggestions.push({
          type: 'specialty_link',
          source: credId,
          target: cred.specialty,
          confidence: 0.8,
          rationale: `Credential ${credId} has specialty ${cred.specialty} but no ontology link`,
        });
      }
    });
  }

  // Infer role links from training paths
  if (partialData.trainingPaths) {
    Object.entries(partialData.trainingPaths).forEach(([pathId, path]: [string, any]) => {
      if (path.role && !path.roleLink) {
        suggestions.push({
          type: 'role_link',
          source: pathId,
          target: path.role,
          confidence: 0.75,
          rationale: `Training path ${pathId} has role ${path.role} but no ontology link`,
        });
      }
    });
  }

  // Infer training links from credentials
  if (partialData.credentials && partialData.trainingPaths) {
    Object.entries(partialData.credentials).forEach(([credId, cred]: [string, any]) => {
      if (cred.trainingLevel) {
        const matchingPath = Object.entries(partialData.trainingPaths).find(
          ([_, path]: [string, any]) => path.level === cred.trainingLevel
        );
        if (matchingPath && !cred.trainingLink) {
          suggestions.push({
            type: 'training_link',
            source: credId,
            target: matchingPath[0],
            confidence: 0.7,
            rationale: `Credential ${credId} matches training level but no link exists`,
          });
        }
      }
    });
  }

  // Calculate overall confidence
  const avgConfidence = suggestions.length > 0
    ? suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length
    : 0;

  return {
    suggestions,
    confidence: avgConfidence,
  };
}








