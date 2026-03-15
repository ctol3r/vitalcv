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

export type QueryIntentType =
  | 'ENTITY_DISCOVERY'
  | 'TRUST_FILTER'
  | 'ORGANIZATION_FILTER'
  | 'LOCATION_FILTER'
  | 'GENERIC';

export interface QueryIntent {
  rawQuery: string;
  normalizedQuery: string;
  tokens: string[];
  intentType: QueryIntentType;
  entityTerm: string | null;
  regionTerm: string | null;
  organizationTerm: string | null;
  requiresHighTrust: boolean;
  template: string;
}

function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}

function tokenize(value: string): string[] {
  return value.split(/[^a-z0-9]+/g).filter(Boolean);
}

function readRegionTerm(query: string): string | null {
  const inMatch = query.match(/\bin ([a-z ]+)$/);
  if (!inMatch?.[1]) {
    return null;
  }

  const rawValue = inMatch[1].trim().toLowerCase();
  if (STATE_ALIASES[rawValue]) {
    return rawValue;
  }

  return rawValue.length > 1 ? rawValue : null;
}

function readOrganizationTerm(query: string): string | null {
  const atMatch = query.match(/\bat ([a-z0-9&.' -]+)$/);
  if (!atMatch?.[1]) {
    return null;
  }

  const value = atMatch[1].trim();
  return value.length > 1 ? value : null;
}

function readEntityTerm(query: string): string | null {
  const stripped = query
    .replace(/\b(with|in|at|near|for)\b.*$/g, '')
    .trim();

  return stripped.length > 0 ? stripped : null;
}

function buildTemplate(intent: {
  entityTerm: string | null;
  regionTerm: string | null;
  organizationTerm: string | null;
  requiresHighTrust: boolean;
}): string {
  const entityTerm = intent.entityTerm ?? 'query';
  if (intent.organizationTerm) {
    return `${entityTerm} at ORGANIZATION`;
  }
  if (intent.regionTerm) {
    return `${entityTerm} in REGION`;
  }
  if (intent.requiresHighTrust) {
    return `${entityTerm} with HIGH_TRUST`;
  }
  return entityTerm;
}

export function parseQueryIntent(query: string): QueryIntent {
  const normalizedQuery = normalizeQuery(query);
  const tokens = tokenize(normalizedQuery);
  const regionTerm = readRegionTerm(normalizedQuery);
  const organizationTerm = readOrganizationTerm(normalizedQuery);
  const requiresHighTrust = /\b(high trust|trust score|verified|best trusted|top trust)\b/.test(normalizedQuery);
  const entityTerm = readEntityTerm(normalizedQuery);
  let intentType: QueryIntentType = 'GENERIC';

  if (organizationTerm) {
    intentType = 'ORGANIZATION_FILTER';
  } else if (regionTerm) {
    intentType = 'LOCATION_FILTER';
  } else if (requiresHighTrust) {
    intentType = 'TRUST_FILTER';
  } else if (entityTerm) {
    intentType = 'ENTITY_DISCOVERY';
  }

  return {
    rawQuery: query,
    normalizedQuery,
    tokens,
    intentType,
    entityTerm,
    regionTerm,
    organizationTerm,
    requiresHighTrust,
    template: buildTemplate({
      entityTerm,
      regionTerm,
      organizationTerm,
      requiresHighTrust,
    }),
  };
}
