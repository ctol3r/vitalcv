export interface OcrTextBlock {
  text: string;
  confidence?: number;
}

export interface OcrFieldCandidate {
  label?: string;
  value: string;
  confidence?: number;
}

export interface OcrPayload {
  fullText?: string;
  blocks?: OcrTextBlock[];
  fields?: OcrFieldCandidate[];
  metadata?: Record<string, unknown>;
}

export interface LicenseFields {
  licenseNumber: string | null;
  expirationDate: string | null;
  stateCode: string | null;
  issueDate?: string | null;
  holderName?: string | null;
  addressLine?: string | null;
  matches: Partial<Record<'licenseNumber' | 'expirationDate' | 'stateCode', string>>;
  confidences: Partial<Record<'licenseNumber' | 'expirationDate' | 'stateCode', number>>;
  extractedAt: string;
  rawText: string;
}

const LICENSE_LABELS = ['license', 'lic#', 'lic no', 'license #', 'credential'];
const EXPIRATION_LABELS = ['expires', 'expiration', 'exp date', 'valid thru', 'valid through', 'expiry'];
const STATE_LABELS = ['state', 'issuing state', 'jurisdiction'];

const LICENSE_REGEXES = [
  /\blic(?:ense|#| no\.?)?\s*(?:number|no\.|#)?\s*[:\-]?\s*([A-Z0-9\-]{4,})/iu,
  /\b([A-Z]{1,3}\d{4,}(?:-\d{1,4})?)\b/u,
];

const EXPIRATION_PATTERNS = [
  /\b(?:exp|expires|expiration|valid(?:\s+thru|\s+through)?)\s*(?:date|on|:|#)?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/iu,
  /\b(?:exp|expires|expiration)\s*(?:date|on|:)?\s*([A-Z]{3}\s+\d{1,2},\s+\d{4})/iu,
  /\bvalid\s*until\s*([A-Z]{3}\s+\d{1,2}\s+\d{4})/iu,
  /\b(?:expires|expiration)\s*(?:date|on|:)?\s*([A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4})/u,
];

const STATE_DATA: Array<{ code: string; names: string[] }> = [
  { code: 'AL', names: ['AL', 'ALABAMA', 'ALA'] },
  { code: 'AK', names: ['AK', 'ALASKA'] },
  { code: 'AZ', names: ['AZ', 'ARIZONA', 'ARIZ'] },
  { code: 'AR', names: ['AR', 'ARKANSAS', 'ARK'] },
  { code: 'CA', names: ['CA', 'CALIFORNIA', 'CALIF', 'CAL.'] },
  { code: 'CO', names: ['CO', 'COLORADO', 'COLO'] },
  { code: 'CT', names: ['CT', 'CONNECTICUT', 'CONN'] },
  { code: 'DE', names: ['DE', 'DELAWARE'] },
  { code: 'DC', names: ['DC', 'DISTRICT OF COLUMBIA', 'D.C.'] },
  { code: 'FL', names: ['FL', 'FLORIDA', 'FLA'] },
  { code: 'GA', names: ['GA', 'GEORGIA', 'GA.'] },
  { code: 'HI', names: ['HI', 'HAWAII'] },
  { code: 'ID', names: ['ID', 'IDAHO'] },
  { code: 'IL', names: ['IL', 'ILLINOIS', 'ILL.'] },
  { code: 'IN', names: ['IN', 'INDIANA', 'IND.'] },
  { code: 'IA', names: ['IA', 'IOWA'] },
  { code: 'KS', names: ['KS', 'KANSAS', 'KAN'] },
  { code: 'KY', names: ['KY', 'KENTUCKY', 'KY.'] },
  { code: 'LA', names: ['LA', 'LOUISIANA', 'LA.'] },
  { code: 'ME', names: ['ME', 'MAINE'] },
  { code: 'MD', names: ['MD', 'MARYLAND', 'MD.'] },
  { code: 'MA', names: ['MA', 'MASSACHUSETTS', 'MASS'] },
  { code: 'MI', names: ['MI', 'MICHIGAN', 'MICH'] },
  { code: 'MN', names: ['MN', 'MINNESOTA', 'MINN'] },
  { code: 'MS', names: ['MS', 'MISSISSIPPI', 'MISS'] },
  { code: 'MO', names: ['MO', 'MISSOURI', 'MO.'] },
  { code: 'MT', names: ['MT', 'MONTANA', 'MONT'] },
  { code: 'NE', names: ['NE', 'NEBRASKA', 'NEB'] },
  { code: 'NV', names: ['NV', 'NEVADA', 'NEV'] },
  { code: 'NH', names: ['NH', 'NEW HAMPSHIRE'] },
  { code: 'NJ', names: ['NJ', 'NEW JERSEY'] },
  { code: 'NM', names: ['NM', 'NEW MEXICO'] },
  { code: 'NY', names: ['NY', 'NEW YORK', 'N.Y.'] },
  { code: 'NC', names: ['NC', 'NORTH CAROLINA'] },
  { code: 'ND', names: ['ND', 'NORTH DAKOTA'] },
  { code: 'OH', names: ['OH', 'OHIO'] },
  { code: 'OK', names: ['OK', 'OKLAHOMA'] },
  { code: 'OR', names: ['OR', 'OREGON'] },
  { code: 'PA', names: ['PA', 'PENNSYLVANIA', 'PENN'] },
  { code: 'RI', names: ['RI', 'RHODE ISLAND'] },
  { code: 'SC', names: ['SC', 'SOUTH CAROLINA'] },
  { code: 'SD', names: ['SD', 'SOUTH DAKOTA'] },
  { code: 'TN', names: ['TN', 'TENNESSEE', 'TENN'] },
  { code: 'TX', names: ['TX', 'TEXAS', 'TEX.'] },
  { code: 'UT', names: ['UT', 'UTAH'] },
  { code: 'VT', names: ['VT', 'VERMONT'] },
  { code: 'VA', names: ['VA', 'VIRGINIA'] },
  { code: 'WA', names: ['WA', 'WASHINGTON', 'WASH'] },
  { code: 'WV', names: ['WV', 'WEST VIRGINIA'] },
  { code: 'WI', names: ['WI', 'WISCONSIN', 'WISC'] },
  { code: 'WY', names: ['WY', 'WYOMING'] },
];

const STATE_LOOKUP = new Map<string, string>();
for (const { code, names } of STATE_DATA) {
  for (const name of names) {
    STATE_LOOKUP.set(normalizeStateKey(name), code);
  }
}

export function mapLicenseFieldsFromOcr(payload: OcrPayload): LicenseFields {
  const rawText = buildRawText(payload);
  const normalizedText = rawText.toUpperCase();

  const matches: LicenseFields['matches'] = {};
  const confidences: LicenseFields['confidences'] = {};

  const license = extractFieldValue(payload.fields, LICENSE_LABELS) ?? matchRegex(normalizedText, LICENSE_REGEXES);
  if (license) {
    matches.licenseNumber = license.matched;
    confidences.licenseNumber = license.confidence;
  }

  const expiration = extractFieldValue(payload.fields, EXPIRATION_LABELS) ?? matchRegex(normalizedText, EXPIRATION_PATTERNS);
  if (expiration) {
    matches.expirationDate = expiration.matched;
    confidences.expirationDate = expiration.confidence;
  }

  const state =
    extractFieldValue(payload.fields, STATE_LABELS, true) ??
    matchStateFromText(normalizedText);
  if (state) {
    matches.stateCode = state.matched;
    confidences.stateCode = state.confidence;
  }

  return {
    licenseNumber: sanitizeLicense(matches.licenseNumber ?? null),
    expirationDate: normalizeDate(matches.expirationDate ?? null),
    stateCode: normalizeStateCode(matches.stateCode ?? null),
    matches,
    confidences,
    extractedAt: new Date().toISOString(),
    rawText,
  };
}

export function normalizeStateCode(value?: string | null): string | null {
  if (!value) return null;
  const normalized = STATE_LOOKUP.get(normalizeStateKey(value));
  return normalized ?? null;
}

function normalizeStateKey(value: string): string {
  return value.replace(/[^A-Z]/gi, '').toUpperCase();
}

function buildRawText(payload: OcrPayload): string {
  if (payload.fullText) return payload.fullText;
  if (payload.blocks?.length) return payload.blocks.map((block) => block.text).join('\n');
  if (payload.fields?.length) return payload.fields.map((field) => `${field.label ?? ''} ${field.value}`.trim()).join('\n');
  return '';
}

function extractFieldValue(
  fields: OcrFieldCandidate[] | undefined,
  labels: string[],
  allowValueIsLabel = false
): { matched: string; confidence: number } | null {
  if (!fields?.length) return null;
  const normalizedLabels = labels.map((label) => label.toLowerCase());

  for (const field of fields) {
    const label = field.label?.toLowerCase();
    if (!label && !allowValueIsLabel) continue;
    const value = (field.value ?? '').trim();
    if (!value) continue;

    if ((label && normalizedLabels.some((needle) => label.includes(needle))) || (allowValueIsLabel && normalizedLabels.some((needle) => value.toLowerCase().includes(needle)))) {
      return { matched: value, confidence: field.confidence ?? 0.92 };
    }
  }

  return null;
}

function matchRegex(
  text: string,
  regexes: Array<RegExp>
): { matched: string; confidence: number } | null {
  for (const regex of regexes) {
    const match = regex.exec(text);
    if (match && match[1]) {
      return { matched: match[1].trim(), confidence: 0.75 };
    }
  }
  return null;
}

function sanitizeLicense(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/[^A-Z0-9\-]/gi, '').toUpperCase();
}

function normalizeDate(value: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  const numericMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (numericMatch) {
    const month = Number(numericMatch[1]);
    const day = Number(numericMatch[2]);
    const year = Number(numericMatch[3].length === 2 ? `20${numericMatch[3]}` : numericMatch[3]);
    const iso = new Date(Date.UTC(year, month - 1, day));
    if (!isNaN(iso.getTime())) {
      return iso.toISOString();
    }
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return null;
}

function matchStateFromText(text: string): { matched: string; confidence: number } | null {
  for (const [key, code] of STATE_LOOKUP.entries()) {
    if (key.length <= 2) continue;
    if (text.includes(key)) {
      return { matched: code, confidence: 0.65 };
    }
  }
  return null;
}











