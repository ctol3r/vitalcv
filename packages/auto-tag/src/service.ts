// packages/auto-tag/src/service.ts

import type {
  TaggedProfile,
  NERResult,
  OntologyMapping,
  SpecialtyClassification,
  WorkflowPattern,
  LinkInference,
} from './types';

interface ProviderInput {
  id: string;
  text: string;
  credentials: any;
  career: any;
}

interface NERService {
  extract(text: string): Promise<string[]>;
}

interface OntologyMapper {
  umlsSnCt(entities: string[]): Promise<string[]>;
}

interface Classifier {
  specialties(input: any): Promise<string[]>;
}

interface WorkflowPatternMatcher {
  workflows(hist: any): Promise<string[]>;
}

interface LinkInferrer {
  infer(
    specs: string[],
    creds: string[],
    flows: string[]
  ): Array<{ from: string; to: string; rel: string; meta?: any }>;
}

export class AutoTagService {
  constructor(
    private ner: NERService,
    private map: OntologyMapper,
    private classify: Classifier,
    private patterns: WorkflowPatternMatcher,
    private links: LinkInferrer
  ) {}

  async tag(provider: ProviderInput): Promise<TaggedProfile> {
    const entities = await this.ner.extract(provider.text);
    const mapped = await this.map.umlsSnCt(entities);
    const specs = await this.classify.specialties(provider.credentials);
    const flows = await this.patterns.workflows(provider.career);
    const rels = this.links.infer(specs, mapped, flows);

    return {
      providerId: provider.id,
      entityTags: mapped,
      specialtyTags: specs,
      workflowTags: flows,
      relationships: rels,
      confidence: Object.fromEntries(mapped.map((m) => [m, 0.95])),
    };
  }
}

