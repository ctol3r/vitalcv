import type {
  CopilotGraphTraversal,
  CopilotIntent,
  CopilotRankingWeights,
  CopilotStructuredFilters,
  ParsedCopilotQuery,
} from './copilotEngine';

type SpecialtyEntry = {
  canonical: string;
  aliases: string[];
};

const SPECIALTY_DICTIONARY: SpecialtyEntry[] = [
  { canonical: 'Cardiology', aliases: ['cardiology', 'cardiologist', 'cardiologists', 'cardiac'] },
  { canonical: 'Oncology', aliases: ['oncology', 'oncologist', 'oncologists'] },
  { canonical: 'Neurology', aliases: ['neurology', 'neurologist', 'neurologists'] },
  { canonical: 'Dermatology', aliases: ['dermatology', 'dermatologist', 'dermatologists'] },
  { canonical: 'Psychiatry', aliases: ['psychiatry', 'psychiatrist', 'psychiatrists'] },
  { canonical: 'Pediatrics', aliases: ['pediatrics', 'pediatrician', 'pediatricians'] },
  { canonical: 'Internal Medicine', aliases: ['internal medicine', 'internist', 'internists', 'hospitalist', 'hospitalists'] },
  { canonical: 'Family Medicine', aliases: ['family medicine', 'family physician', 'family practice'] },
  { canonical: 'Radiology', aliases: ['radiology', 'radiologist', 'radiologists'] },
  { canonical: 'Orthopedic Surgery', aliases: ['orthopedic surgery', 'orthopedics', 'orthopedic', 'orthopaedic'] },
  { canonical: 'Emergency Medicine', aliases: ['emergency medicine', 'er physician', 'em physician'] },
  { canonical: 'Anesthesiology', aliases: ['anesthesiology', 'anesthesia', 'anesthesiologist'] },
  { canonical: 'Critical Care Medicine', aliases: ['critical care', 'critical care medicine', 'intensivist', 'intensivists'] },
  { canonical: 'Gastroenterology', aliases: ['gastroenterology', 'gastroenterologist'] },
  { canonical: 'Pulmonology', aliases: ['pulmonology', 'pulmonologist'] },
  { canonical: 'Endocrinology', aliases: ['endocrinology', 'endocrinologist'] },
  { canonical: 'Nephrology', aliases: ['nephrology', 'nephrologist'] },
  { canonical: 'Infectious Disease', aliases: ['infectious disease', 'infectious diseases'] },
  { canonical: 'Hematology', aliases: ['hematology', 'hematologist'] },
  { canonical: 'Obstetrics and Gynecology', aliases: ['ob/gyn', 'obgyn', 'obstetrics', 'gynecology', 'obstetrician'] },
];

const STATE_ALIASES: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
  dc: 'DC',
  'district of columbia': 'DC',
};

const STATE_CODES = new Set(Object.values(STATE_ALIASES));

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'with', 'without',
  'show', 'find', 'list', 'near', 'me', 'all', 'who', 'what', 'where', 'which',
  'providers', 'provider', 'doctor', 'doctors', 'physician', 'physicians', 'clinician',
  'clinicians', 'high', 'low', 'score', 'trust', 'trusted', 'best', 'top',
]);

const EXPLAINABILITY_TERMS = /\b(why|explain|because|how does|how did|show why|reason)\b/i;
const GRAPH_TERMS = /\b(graph|network|neighbors?|connections?|connected|collaborators?|published with|works with|affiliated with|institution connections?)\b/i;
const RESEARCH_TERMS = /\b(research|publication|publications|trial|trials|abstracts?|investigator|investigators|claims explanations?)\b/i;
const DUE_DILIGENCE_TERMS = /\b(trust|verified|license|licensure|board certified|board certification|payments|oig|pecos|nppes|source coverage)\b/i;

function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}

function tokenize(value: string): string[] {
  return value
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter(Boolean);
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function extractKeywords(normalizedQuery: string): string[] {
  const keywords: string[] = [];
  for (const token of tokenize(normalizedQuery)) {
    if (token.length < 2 || STOPWORDS.has(token)) {
      continue;
    }
    keywords.push(token);
  }
  return dedupeStrings(keywords);
}

function extractSpecialties(normalizedQuery: string): string[] {
  return dedupeStrings(
    SPECIALTY_DICTIONARY
      .filter((entry) => entry.aliases.some((alias) => normalizedQuery.includes(alias)))
      .map((entry) => entry.canonical),
  );
}

function extractStates(rawQuery: string, normalizedQuery: string): string[] {
  const states = new Set<string>();

  for (const [stateName, stateCode] of Object.entries(STATE_ALIASES)) {
    if (normalizedQuery.includes(stateName)) {
      states.add(stateCode);
    }
  }

  const codeMatches = rawQuery.match(/\b(?:in|from|near|licensed in|based in|across)\s+([A-Za-z]{2})\b/g) ?? [];
  for (const match of codeMatches) {
    const stateCode = match.slice(-2).toUpperCase();
    if (STATE_CODES.has(stateCode)) {
      states.add(stateCode);
    }
  }

  return [...states];
}

function cleanCapturedPhrase(value: string): string {
  return value
    .replace(/\s+(?:with|who|that|having|where|licensed|board certified|high trust|low trust).*$/i, '')
    .replace(/[.,;:]+$/g, '')
    .trim();
}

function extractCapturedPhrases(rawQuery: string, patterns: RegExp[]): string[] {
  const matches: string[] = [];

  for (const pattern of patterns) {
    for (const match of rawQuery.matchAll(pattern)) {
      const captured = cleanCapturedPhrase(match[1] ?? '');
      if (captured.length >= 3) {
        matches.push(captured);
      }
    }
  }

  return dedupeStrings(matches);
}

function extractInstitutions(rawQuery: string): string[] {
  return extractCapturedPhrases(rawQuery, [
    /\b(?:at|from|near)\s+([A-Za-z0-9&.' -]{3,80})/gi,
    /\b(?:institution|hospital|clinic|system)\s+([A-Za-z0-9&.' -]{3,80})/gi,
  ]);
}

function extractAffiliations(rawQuery: string): string[] {
  return extractCapturedPhrases(rawQuery, [
    /\b(?:affiliated with|connected to|collaborators? at|works at|trained at)\s+([A-Za-z0-9&.' -]{3,80})/gi,
  ]);
}

function extractLicenseStatuses(normalizedQuery: string): string[] {
  const statuses: string[] = [];

  if (/\b(active|licensed|current)\b/.test(normalizedQuery)) {
    statuses.push('ACTIVE');
  }
  if (/\b(revoked|revocation)\b/.test(normalizedQuery)) {
    statuses.push('REVOKED');
  }
  if (/\b(suspended|suspension)\b/.test(normalizedQuery)) {
    statuses.push('SUSPENDED');
  }
  if (/\b(expired|expiration|lapsed)\b/.test(normalizedQuery)) {
    statuses.push('EXPIRED');
  }

  return dedupeStrings(statuses);
}

function extractTrustScore(normalizedQuery: string): CopilotStructuredFilters['trustScore'] {
  const minPatterns = [
    /\btrust score (?:above|over|greater than|>=|at least|min(?:imum)?)\s*(\d{1,3})\b/,
    /\b(?:above|over|greater than|>=|at least|min(?:imum)?)\s*(\d{1,3})\s*(?:trust score|trust)\b/,
    /\btrust score\s*>\s*(\d{1,3})\b/,
  ];
  const maxPatterns = [
    /\btrust score (?:below|under|less than|<=|at most|max(?:imum)?)\s*(\d{1,3})\b/,
    /\b(?:below|under|less than|<=|at most|max(?:imum)?)\s*(\d{1,3})\s*(?:trust score|trust)\b/,
    /\btrust score\s*<\s*(\d{1,3})\b/,
  ];

  let min: number | undefined;
  let max: number | undefined;

  for (const pattern of minPatterns) {
    const match = normalizedQuery.match(pattern);
    if (match?.[1]) {
      min = Number(match[1]);
      break;
    }
  }

  for (const pattern of maxPatterns) {
    const match = normalizedQuery.match(pattern);
    if (match?.[1]) {
      max = Number(match[1]);
      break;
    }
  }

  if (min === undefined && /\b(high trust|high trust score|trusted|strong trust)\b/.test(normalizedQuery)) {
    min = 80;
  }

  if (max === undefined && /\b(low trust|weak trust)\b/.test(normalizedQuery)) {
    max = 40;
  }

  return min === undefined && max === undefined ? undefined : { min, max };
}

function extractBoardCertification(normalizedQuery: string): boolean | undefined {
  if (/\b(not board certified|without board certification)\b/.test(normalizedQuery)) {
    return false;
  }
  if (/\b(board certified|board certification)\b/.test(normalizedQuery)) {
    return true;
  }
  return undefined;
}

function extractPayments(normalizedQuery: string): CopilotStructuredFilters['payments'] {
  if (/\b(no payments|without payments|no open payments)\b/.test(normalizedQuery)) {
    return 'NO_PAYMENTS';
  }
  if (/\b(low payments|minimal payments|limited payments)\b/.test(normalizedQuery)) {
    return 'LOW_PAYMENTS';
  }
  if (/\b(open payments|payments|payment history)\b/.test(normalizedQuery)) {
    return 'HAS_PAYMENTS';
  }
  return undefined;
}

function extractResearchTopics(normalizedQuery: string, keywords: string[], specialties: string[]): string[] {
  const extracted = new Set<string>();

  for (const match of normalizedQuery.matchAll(/\b(?:research|publication|publications|trial|trials|claims?)\s+(?:on|about|for)\s+([a-z0-9 ,&-]{3,80})/g)) {
    const topic = cleanCapturedPhrase(match[1] ?? '');
    if (topic.length > 0) {
      extracted.add(topic);
    }
  }

  if (RESEARCH_TERMS.test(normalizedQuery)) {
    for (const keyword of keywords) {
      if (!['research', 'publication', 'publications', 'trial', 'trials', 'claims', 'claim'].includes(keyword)) {
        extracted.add(keyword);
      }
    }
  }

  for (const specialty of specialties) {
    extracted.add(specialty);
  }

  return [...extracted].slice(0, 8);
}

function detectGraphTraversal(normalizedQuery: string): CopilotGraphTraversal[] {
  const traversal: CopilotGraphTraversal[] = [];

  if (/\bneighbors?|connected|connection|connections\b/.test(normalizedQuery)) {
    traversal.push('NEIGHBORS');
  }
  if (/\bcollaborators?|published with|works with\b/.test(normalizedQuery)) {
    traversal.push('COLLABORATORS');
  }
  if (/\binstitution connections?|affiliated with|trained at\b/.test(normalizedQuery)) {
    traversal.push('INSTITUTION_CONNECTIONS');
  }
  if (/\btrial investigators?|investigators?\b/.test(normalizedQuery)) {
    traversal.push('TRIAL_INVESTIGATORS');
  }
  if (/\bpublication networks?|publication|publications\b/.test(normalizedQuery)) {
    traversal.push('PUBLICATION_NETWORKS');
  }

  if (traversal.length === 0 && GRAPH_TERMS.test(normalizedQuery)) {
    traversal.push('NEIGHBORS');
  }

  return dedupeStrings(traversal) as CopilotGraphTraversal[];
}

function normalizeWeights(weights: CopilotRankingWeights): CopilotRankingWeights {
  const total = weights.relevance + weights.trustScore + weights.freshness + weights.sourceCoverage;
  if (total <= 0) {
    return { relevance: 0.45, trustScore: 0.25, freshness: 0.15, sourceCoverage: 0.15 };
  }

  return {
    relevance: weights.relevance / total,
    trustScore: weights.trustScore / total,
    freshness: weights.freshness / total,
    sourceCoverage: weights.sourceCoverage / total,
  };
}

function buildRankingWeights(intent: CopilotIntent, structuredFilters: CopilotStructuredFilters): CopilotRankingWeights {
  if (intent === 'EXPLAINABILITY') {
    return normalizeWeights({ relevance: 0.3, trustScore: 0.25, freshness: 0.15, sourceCoverage: 0.3 });
  }

  if (intent === 'DUE_DILIGENCE' || structuredFilters.trustScore !== undefined) {
    return normalizeWeights({ relevance: 0.35, trustScore: 0.35, freshness: 0.15, sourceCoverage: 0.15 });
  }

  if (intent === 'RESEARCH_DISCOVERY') {
    return normalizeWeights({ relevance: 0.45, trustScore: 0.15, freshness: 0.15, sourceCoverage: 0.25 });
  }

  if (intent === 'GRAPH_EXPLORATION') {
    return normalizeWeights({ relevance: 0.4, trustScore: 0.2, freshness: 0.15, sourceCoverage: 0.25 });
  }

  return normalizeWeights({ relevance: 0.5, trustScore: 0.2, freshness: 0.15, sourceCoverage: 0.15 });
}

function detectIntent(
  normalizedQuery: string,
  structuredFilters: CopilotStructuredFilters,
  graphTraversal: CopilotGraphTraversal[],
): CopilotIntent {
  if (EXPLAINABILITY_TERMS.test(normalizedQuery)) {
    return 'EXPLAINABILITY';
  }

  if (graphTraversal.length > 0) {
    return 'GRAPH_EXPLORATION';
  }

  if (RESEARCH_TERMS.test(normalizedQuery) || structuredFilters.researchTopics.length > 0) {
    return 'RESEARCH_DISCOVERY';
  }

  if (
    DUE_DILIGENCE_TERMS.test(normalizedQuery) ||
    structuredFilters.trustScore !== undefined ||
    structuredFilters.licenseStatuses.length > 0 ||
    structuredFilters.boardCertified !== undefined ||
    structuredFilters.payments !== undefined
  ) {
    return 'DUE_DILIGENCE';
  }

  if (normalizedQuery.length > 0) {
    return 'DISCOVERY';
  }

  return 'GENERAL';
}

export function interpretCopilotQuery(rawQuery: string): ParsedCopilotQuery {
  const normalizedQuery = normalizeQuery(rawQuery);
  const keywords = extractKeywords(normalizedQuery);
  const specialties = extractSpecialties(normalizedQuery);
  const states = extractStates(rawQuery, normalizedQuery);
  const institutions = extractInstitutions(rawQuery);
  const affiliations = extractAffiliations(rawQuery);
  const graphTraversal = detectGraphTraversal(normalizedQuery);

  const structuredFilters: CopilotStructuredFilters = {
    specialties,
    states,
    institutions,
    licenseStatuses: extractLicenseStatuses(normalizedQuery),
    trustScore: extractTrustScore(normalizedQuery),
    boardCertified: extractBoardCertification(normalizedQuery),
    researchTopics: extractResearchTopics(normalizedQuery, keywords, specialties),
    payments: extractPayments(normalizedQuery),
    affiliations,
  };

  const intent = detectIntent(normalizedQuery, structuredFilters, graphTraversal);
  const semanticTopics = dedupeStrings([
    ...specialties,
    ...states,
    ...institutions,
    ...affiliations,
    ...structuredFilters.researchTopics,
    ...keywords,
  ]).slice(0, 12);

  return {
    rawQuery,
    normalizedQuery,
    intent,
    keywords,
    structuredFilters,
    semanticTopics,
    graphTraversal,
    rankingWeights: buildRankingWeights(intent, structuredFilters),
  };
}
