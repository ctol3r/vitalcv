import crypto from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import { fetchNpiFromCMS, normalizeProvider, type NormalizedProvider } from '../../modules/identity';
import { getLlmProvider } from '../providers/llmProvider';
import { sha256ForPayload } from '../../utils/deterministic';
import { HttpError } from '../../utils/httpError';

export type ProfileDraftProvenance = 'AI_DRAFT';

export interface NpiProfileSourceFact {
  field: string;
  value: string;
  sourceId: 'NPPES_API';
  sourceUrl: string;
  observedAt: string;
  sourceLastUpdated: string | null;
  limitation: string;
}

export interface NpiProfileDraft {
  draftId: string;
  npi: string;
  generatedAt: string;
  sourceFacts: NpiProfileSourceFact[];
  suggestedNarrative: {
    headline: string | null;
    professionalSummary: string | null;
  };
  missingSections: string[];
  warnings: string[];
  provenance: ProfileDraftProvenance;
}

const NPPES_LIMITATION =
  'NPPES is a public identity and taxonomy registry. It does not by itself verify current licensure, board certification, education, employment, privileges, competence, or employer acceptance.';

const MISSING_SECTIONS = [
  'education and training',
  'employment history',
  'board certifications',
  'current state-license status and expiration',
  'professional references',
  'malpractice and claims history',
  'work authorization',
  'immunizations and occupational-health records',
] as const;

function sourceUrl(npi: string): string {
  return `https://npiregistry.cms.hhs.gov/api/?number=${encodeURIComponent(npi)}&version=2.1`;
}

function addFact(
  facts: NpiProfileSourceFact[],
  input: {
    field: string;
    value: string | null | undefined;
    npi: string;
    observedAt: string;
    sourceLastUpdated?: string | null;
  },
): void {
  const value = input.value?.trim();
  if (!value) return;
  facts.push({
    field: input.field,
    value,
    sourceId: 'NPPES_API',
    sourceUrl: sourceUrl(input.npi),
    observedAt: input.observedAt,
    sourceLastUpdated: input.sourceLastUpdated ?? null,
    limitation: NPPES_LIMITATION,
  });
}

function buildSourceFacts(provider: NormalizedProvider, observedAt: string): NpiProfileSourceFact[] {
  const facts: NpiProfileSourceFact[] = [];
  const common = {
    npi: provider.npi,
    observedAt,
    sourceLastUpdated: provider.last_updated || null,
  };

  addFact(facts, { ...common, field: 'npi', value: provider.npi });
  addFact(facts, { ...common, field: 'displayName', value: provider.display_name });
  addFact(facts, { ...common, field: 'credentialSuffix', value: provider.credential });
  addFact(facts, { ...common, field: 'nppesStatus', value: provider.status });
  addFact(facts, { ...common, field: 'primaryTaxonomy', value: provider.primary_taxonomy });
  addFact(facts, { ...common, field: 'primaryTaxonomyCode', value: provider.primary_taxonomy_code });
  addFact(facts, { ...common, field: 'practiceCity', value: provider.practice_address?.city });
  addFact(facts, { ...common, field: 'practiceState', value: provider.practice_address?.state });
  addFact(facts, { ...common, field: 'enumerationDate', value: provider.enumeration_date });
  addFact(facts, { ...common, field: 'recordCertificationDate', value: provider.certification_date });

  return facts;
}

function deterministicHeadline(provider: NormalizedProvider): string | null {
  const specialty = provider.primary_taxonomy?.trim();
  const state = provider.practice_address?.state?.trim();
  if (specialty && state) return `${specialty} · ${state}`;
  if (specialty) return specialty;
  if (provider.credential?.trim()) return `Clinician · ${provider.credential.trim()}`;
  return 'Clinician profile';
}

function deterministicSummary(provider: NormalizedProvider): string {
  const name = provider.display_name?.trim() || `Clinician with NPI ${provider.npi}`;
  const specialty = provider.primary_taxonomy?.trim();
  const city = provider.practice_address?.city?.trim();
  const state = provider.practice_address?.state?.trim();
  const location = [city, state].filter(Boolean).join(', ');
  const clauses = [
    `${name} is listed in the CMS NPPES registry under NPI ${provider.npi}`,
    specialty ? `with a primary taxonomy of ${specialty}` : null,
    location ? `and a practice location in ${location}` : null,
  ].filter((value): value is string => Boolean(value));

  return `${clauses.join(' ')}. Education, employment, certifications, licensure status, and other career details must be added or corroborated separately before this profile is used for an employer decision.`;
}

function cleanNarrative(value: string, fallback: string): string {
  const cleaned = value
    .replace(/^```(?:text|markdown)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/^['"]|['"]$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1_200);

  if (!cleaned || cleaned.startsWith('[stub]')) return fallback;
  return cleaned;
}

async function generateProfessionalSummary(provider: NormalizedProvider): Promise<string> {
  const fallback = deterministicSummary(provider);
  const facts = {
    npi: provider.npi,
    displayName: provider.display_name || null,
    credentialSuffix: provider.credential || null,
    nppesStatus: provider.status || null,
    primaryTaxonomy: provider.primary_taxonomy || null,
    primaryTaxonomyCode: provider.primary_taxonomy_code || null,
    practiceCity: provider.practice_address?.city || null,
    practiceState: provider.practice_address?.state || null,
    nppesLastUpdated: provider.last_updated || null,
  };

  try {
    const response = await getLlmProvider().chat(
      [
        {
          role: 'system',
          content:
            'You write a two-sentence clinician profile draft from a CMS NPPES fact object. Use only facts explicitly present. Do not infer or claim education, training, employer history, years of experience, licensure status, board certification, procedures, achievements, publications, competence, privileges, sanctions, availability, or readiness. State that missing career and credential details require clinician input or separate source corroboration. Return plain text only.',
        },
        {
          role: 'user',
          content: JSON.stringify(facts),
        },
      ],
      { maxTokens: 220 },
    );
    return cleanNarrative(response, fallback);
  } catch {
    return fallback;
  }
}

export async function composeNpiProfileDraft(userId: string): Promise<NpiProfileDraft> {
  const profile = await prisma.personProfile.findUnique({
    where: { userId },
    select: { npi: true },
  });
  if (!profile?.npi) {
    throw new HttpError(404, 'Connect an NPI before composing a profile draft.');
  }

  let fetchResult;
  try {
    fetchResult = await fetchNpiFromCMS(profile.npi);
  } catch {
    throw new HttpError(
      503,
      'CMS NPPES is temporarily unavailable. No profile draft was created; try again when the source can be read.',
    );
  }
  if (!fetchResult) {
    throw new HttpError(
      503,
      'CMS NPPES did not return a readable record. No profile draft was created.',
    );
  }

  const provider = normalizeProvider(fetchResult.rawPayload);
  if (provider.enumeration_type !== 'NPI-1') {
    throw new HttpError(400, 'NPI profile composition is currently available for individual Type-1 NPIs.');
  }

  const generatedAt = new Date().toISOString();
  const draftId = crypto.randomUUID();
  const professionalSummary = await generateProfessionalSummary(provider);
  const sourceFacts = buildSourceFacts(provider, generatedAt);
  const draft: NpiProfileDraft = {
    draftId,
    npi: provider.npi,
    generatedAt,
    sourceFacts,
    suggestedNarrative: {
      headline: deterministicHeadline(provider),
      professionalSummary,
    },
    missingSections: [...MISSING_SECTIONS],
    warnings: [
      'This is an AI draft, not a verified CV and not an employer credentialing decision.',
      NPPES_LIMITATION,
      'Nothing in this draft is saved, published, or shared until the clinician explicitly approves a later action.',
    ],
    provenance: 'AI_DRAFT',
  };

  await prisma.auditEvent.create({
    data: {
      type: 'profile_ai_draft_composed',
      referenceId: draftId,
      hash: sha256ForPayload({
        draftId,
        userId,
        npi: provider.npi,
        generatedAt,
        sourceFactFields: sourceFacts.map((fact) => fact.field),
        narrativeHash: sha256ForPayload(professionalSummary),
      }),
      metadata: {
        userId,
        npi: provider.npi,
        provenance: draft.provenance,
        sourceId: 'NPPES_API',
        sourceFactFields: sourceFacts.map((fact) => fact.field),
        persisted: false,
        shared: false,
      },
    },
  });

  return draft;
}
