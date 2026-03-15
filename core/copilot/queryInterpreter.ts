import type {
  CopilotGraphTraversal,
  CopilotIntent,
  CopilotRankingWeights,
  CopilotStructuredFilters,
  ParsedCopilotQuery,
} from './copilotEngine';

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'at',
  'by',
  'for',
  'from',
  'in',
  'into',
  'is',
  'of',
  'on',
  'or',
  'show',
  'the',
  'to',
  'with',
]);

const SPECIALTY_ALIASES: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\bcardiolog(?:ist|y|ists)\b/i, value: 'Cardiology' },
  { pattern: /\belectrophysiolog(?:ist|y|ists)\b/i, value: 'Electrophysiology' },
  { pattern: /\binterventional cardiolog(?:ist|y|ists)\b/i, value: 'Interventional Cardiology' },
  { pattern: /\bpsychiatr(?:ist|y|ists)\b/i, value: 'Psychiatry' },
  { pattern: /\bneurolog(?:ist|y|ists)\b/i, value: 'Neurology' },
  { pattern: /\bhospitalist(?:s)?\b/i, value: 'Hospital Medicine' },
  { pattern: /\binternal medicine\b/i, value: 'Internal Medicine' },
  { pattern: /\bfamily medicine\b/i, value: 'Family Medicine' },
  { pattern: /\bemergency medicine\b/i, value: 'Emergency Medicine' },
  { pattern: /\bpediatric(?:ian|s|)\b/i, value: 'Pediatrics' },
  { pattern: /\bradiolog(?:ist|y|ists)\b/i, value: 'Radiology' },
  { pattern: /\bob\/gyn|obstetrics|gynecology\b/i, value: 'OB/GYN' },
  { pattern: /\bsurgeon|surgery\b/i, value: 'Surgery' },
  { pattern: /\borthopedic(?:s| surgeon| surgery)?\b/i, value: 'Orthopedics' },
  { pattern: /\bcritical care\b/i, value: 'Critical Care Medicine' },
  { pattern: /\bnephrolog(?:ist|y|ists)\b/i, value: 'Nephrology' },
  { pattern: /\boncolog(?:ist|y|ists)\b/i, value: 'Oncology' },
  { pattern: /\bdermatolog(?:ist|y|ists)\b/i, value: 'Dermatology' },
];

const STATE_ALIASES: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\bcalifornia\b|\bca\b/i, value: 'CA' },
  { pattern: /\btexas\b|\btx\b/i, value: 'TX' },
  { pattern: /\bflorida\b|\bfl\b/i, value: 'FL' },
  { pattern: /\bnew york\b|\bny\b/i, value: 'NY' },
  { pattern: /\bwashington\b|\bwa\b/i, value: 'WA' },
  { pattern: /\boregon\b|\bor\b/i, value: 'OR' },
  { pattern: /\billinois\b|\bil\b/i, value: 'IL' },
  { pattern: /\bcolorado\b|\bco\b/i, value: 'CO' },
  { pattern: /\bmassachusetts\b|\bma\b/i, value: 'MA' },
  { pattern: /\bnew jersey\b|\bnj\b/i, value: 'NJ' },
  { pattern: /\barizona\b|\baz\b/i, value: 'AZ' },
  { pattern: /\bgeorgia\b|\bga\b/i, value: 'GA' },
  { pattern: /\bnorth carolina\b|\bnc\b/i, value: 'NC' },
  { pattern: /\bpennsylvania\b|\bpa\b/i, value: 'PA' },
];

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function tokenize(value: string): string[] {
  return normalizeWhitespace(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function detectIntent(query: string): CopilotIntent {
  if (/\bwhy\b|\bexplain\b|\bhow do you know\b/i.test(query)) {
    return 'EXPLAINABILITY';
  }

  if (
    /\bneighbor(?:s)?\b|\bcollaborator(?:s)?\b|\bnetwork\b|\bconnection(?:s)?\b|\binvestigator(?:s)?\b/i.test(query)
  ) {
    return 'GRAPH_EXPLORATION';
  }

  if (/\bpublication(?:s)?\b|\bresearch\b|\btrial(?:s)?\b/i.test(query)) {
    return 'RESEARCH_DISCOVERY';
  }

  if (/\btrust\b|\bdue diligence\b|\boig\b|\bverified source\b/i.test(query)) {
    return 'DUE_DILIGENCE';
  }

  if (/\bfind\b|\blist\b|\bshow\b|\bwho\b|\bwhich\b/i.test(query)) {
    return 'DISCOVERY';
  }

  return 'GENERAL';
}

function detectSpecialties(query: string): string[] {
  const matches = SPECIALTY_ALIASES
    .filter((candidate) => candidate.pattern.test(query))
    .map((candidate) => candidate.value);
  return uniqueStrings(matches);
}

function detectStates(query: string): string[] {
  const matches = STATE_ALIASES
    .filter((candidate) => candidate.pattern.test(query))
    .map((candidate) => candidate.value);
  return uniqueStrings(matches);
}

function detectInstitutions(query: string): string[] {
  const matches: string[] = [];
  const patterns = [
    /\b(?:at|from|with|affiliated with|connected to)\s+([A-Z][A-Za-z0-9&.' -]{2,60})/g,
    /\b(?:institution|hospital|clinic|group|center)\s*[:=]?\s*([A-Z][A-Za-z0-9&.' -]{2,60})/g,
  ];

  for (const pattern of patterns) {
    for (const match of query.matchAll(pattern)) {
      const value = normalizeWhitespace(match[1] ?? '');
      if (value.length >= 3) {
        matches.push(value);
      }
    }
  }

  return uniqueStrings(matches);
}

function detectTrustScoreRange(query: string): { min?: number; max?: number } | undefined {
  const between = query.match(/\btrust score(?:s)?\s+(?:between|from)\s+(\d{1,3})\s+(?:and|to)\s+(\d{1,3})\b/i);
  if (between) {
    const min = Number(between[1]);
    const max = Number(between[2]);
    return { min: Math.min(min, max), max: Math.max(min, max) };
  }

  const threshold = query.match(/\btrust score(?:s)?\s*(?:>=|>|over|above|at least)\s*(\d{1,3})\b/i);
  if (threshold) {
    return { min: Number(threshold[1]) };
  }

  const upperBound = query.match(/\btrust score(?:s)?\s*(?:<=|<|under|below|at most)\s*(\d{1,3})\b/i);
  if (upperBound) {
    return { max: Number(upperBound[1]) };
  }

  if (/\bhigh trust score\b|\bhighly trusted\b|\btrusted\b/i.test(query)) {
    return { min: 80 };
  }

  if (/\blow trust score\b|\blow trust\b/i.test(query)) {
    return { max: 50 };
  }

  return undefined;
}

function detectLicenseStatuses(query: string): string[] {
  const matches: string[] = [];

  if (/\bactive licen[sc]e\b|\blicensed\b/i.test(query)) {
    matches.push('ACTIVE');
  }
  if (/\bexpired licen[sc]e\b|\bexpired\b/i.test(query)) {
    matches.push('EXPIRED');
  }
  if (/\bsuspended\b/i.test(query)) {
    matches.push('SUSPENDED');
  }
  if (/\brevoked\b/i.test(query)) {
    matches.push('REVOKED');
  }

  return uniqueStrings(matches);
}

function detectBoardCertification(query: string): boolean | undefined {
  if (/\bwithout board cert(?:ification)?\b|\bnot board cert(?:ified)?\b/i.test(query)) {
    return false;
  }

  if (/\bboard cert(?:ified|ification)?\b|\bboard-certified\b/i.test(query)) {
    return true;
  }

  return undefined;
}

function detectResearchTopics(query: string): string[] {
  const matches: string[] = [];
  const patterns = [
    /\bresearch(?:ing)?\s+(?:on|about|in)\s+([a-z0-9 ,&/-]{3,80})/gi,
    /\bpublication(?:s)?\s+(?:on|about|in)\s+([a-z0-9 ,&/-]{3,80})/gi,
    /\btrial(?:s)?\s+(?:on|about|for)\s+([a-z0-9 ,&/-]{3,80})/gi,
  ];

  for (const pattern of patterns) {
    for (const match of query.matchAll(pattern)) {
      matches.push(normalizeWhitespace(match[1] ?? ''));
    }
  }

  return uniqueStrings(matches);
}

function detectPaymentsPreference(query: string): CopilotStructuredFilters['payments'] {
  if (/\bwithout payments\b|\bno payments\b|\bexclude payments\b/i.test(query)) {
    return 'NO_PAYMENTS';
  }

  if (/\blow payments\b|\bminimal payments\b/i.test(query)) {
    return 'LOW_PAYMENTS';
  }

  if (/\bpayments\b|\bopen payments\b/i.test(query)) {
    return 'HAS_PAYMENTS';
  }

  return undefined;
}

function detectAffiliations(query: string): string[] {
  const matches: string[] = [];
  for (const match of query.matchAll(/\baffiliation(?:s)?\s+(?:with|to)\s+([A-Za-z0-9&.' -]{3,80})/gi)) {
    matches.push(normalizeWhitespace(match[1] ?? ''));
  }
  return uniqueStrings(matches);
}

function detectGraphTraversal(query: string): CopilotGraphTraversal[] {
  const traversals: CopilotGraphTraversal[] = [];

  if (/\bneighbor(?:s)?\b/i.test(query)) {
    traversals.push('NEIGHBORS');
  }
  if (/\bcollaborator(?:s)?\b/i.test(query)) {
    traversals.push('COLLABORATORS');
  }
  if (/\binstitution connection(?:s)?\b|\binstitution network\b/i.test(query)) {
    traversals.push('INSTITUTION_CONNECTIONS');
  }
  if (/\btrial investigator(?:s)?\b|\binvestigator network\b/i.test(query)) {
    traversals.push('TRIAL_INVESTIGATORS');
  }
  if (/\bpublication network\b|\bpublication graph\b/i.test(query)) {
    traversals.push('PUBLICATION_NETWORKS');
  }

  return traversals;
}

function detectRankingWeights(query: string, intent: CopilotIntent): CopilotRankingWeights {
  const weights: CopilotRankingWeights = {
    relevance: 0.45,
    trustScore: 0.25,
    freshness: 0.15,
    sourceCoverage: 0.15,
  };

  if (/\brecent\b|\blatest\b|\bfresh\b|\bnewest\b/i.test(query)) {
    weights.relevance -= 0.05;
    weights.freshness += 0.05;
  }

  if (/\btrust\b|\bverified\b|\bdue diligence\b/i.test(query)) {
    weights.relevance -= 0.05;
    weights.trustScore += 0.05;
  }

  if (intent === 'EXPLAINABILITY') {
    weights.relevance -= 0.05;
    weights.sourceCoverage += 0.05;
  }

  const total = weights.relevance + weights.trustScore + weights.freshness + weights.sourceCoverage;

  return {
    relevance: Number((weights.relevance / total).toFixed(4)),
    trustScore: Number((weights.trustScore / total).toFixed(4)),
    freshness: Number((weights.freshness / total).toFixed(4)),
    sourceCoverage: Number((weights.sourceCoverage / total).toFixed(4)),
  };
}

export function interpretCopilotQuery(rawQuery: string): ParsedCopilotQuery {
  const normalizedQuery = normalizeWhitespace(rawQuery);
  const intent = detectIntent(normalizedQuery);
  const specialties = detectSpecialties(normalizedQuery);
  const states = detectStates(normalizedQuery);
  const institutions = detectInstitutions(normalizedQuery);
  const researchTopics = detectResearchTopics(normalizedQuery);
  const affiliations = detectAffiliations(normalizedQuery);
  const graphTraversal = detectGraphTraversal(normalizedQuery);
  const licenseStatuses = detectLicenseStatuses(normalizedQuery);

  const keywords = tokenize(normalizedQuery).filter((token) => token.length > 1);
  const semanticTopics = uniqueStrings([
    ...researchTopics,
    ...specialties,
    ...institutions,
    ...keywords.filter((token) => token.length >= 4),
  ]);

  return {
    rawQuery,
    normalizedQuery,
    intent,
    keywords: uniqueStrings(keywords),
    structuredFilters: {
      specialties,
      states,
      institutions,
      licenseStatuses,
      trustScore: detectTrustScoreRange(normalizedQuery),
      boardCertified: detectBoardCertification(normalizedQuery),
      researchTopics,
      payments: detectPaymentsPreference(normalizedQuery),
      affiliations,
    },
    semanticTopics,
    graphTraversal,
    rankingWeights: detectRankingWeights(normalizedQuery, intent),
  };
}
