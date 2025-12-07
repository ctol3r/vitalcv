// packages/auto-tag/src/types.ts

export interface TaggedProfile {
  providerId: string;
  entityTags: string[];
  specialtyTags: string[];
  workflowTags: string[];
  relationships: Array<{ from: string; to: string; rel: string; meta?: any }>;
  confidence: Record<string, number>;
}

export interface NERResult {
  entities: string[];
  confidence: number[];
}

export interface OntologyMapping {
  umlsCodes: string[];
  snomedCodes: string[];
  cptCodes?: string[];
}

export interface SpecialtyClassification {
  specialties: string[];
  confidence: Record<string, number>;
}

export interface WorkflowPattern {
  workflows: string[];
  procedures: string[];
}

export interface LinkInference {
  relationships: Array<{
    from: string;
    to: string;
    rel: string;
    confidence: number;
    meta?: any;
  }>;
}

