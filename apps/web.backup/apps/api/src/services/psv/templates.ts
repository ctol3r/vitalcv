export type LicenseTemplateType =
  | 'CA_MEDICAL_BOARD'
  | 'TX_MSBME'
  | 'FL_DOH'
  | 'NY_OP'
  | 'WA_DOH'
  | 'UNKNOWN';

export type TemplateSourceType = 'BOARD_PDF' | 'SCANNED_COPY';

export interface TemplateDetectionInput {
  text: string;
  metadata?: {
    mimeType?: string;
    source?: TemplateSourceType;
    producer?: string;
    hasVectorText?: boolean;
  };
}

export interface TemplateParsingConfig {
  licenseLabels: string[];
  expirationLabels: string[];
  watermarkExpected: boolean;
  barcodeZone?: string;
  sealLocation?: 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT';
}

export interface TemplateDetectionResult {
  templateType: LicenseTemplateType;
  sourceType: TemplateSourceType;
  confidence: number;
  parsingConfig: TemplateParsingConfig;
  matchedPhrases: string[];
}

interface TemplateRule {
  templateType: LicenseTemplateType;
  matchers: RegExp[];
  parsingConfig: TemplateParsingConfig;
}

const TEMPLATE_RULES: TemplateRule[] = [
  {
    templateType: 'CA_MEDICAL_BOARD',
    matchers: [/MEDICAL BOARD OF CALIFORNIA/i, /DEPARTMENT OF CONSUMER AFFAIRS/i],
    parsingConfig: {
      licenseLabels: ['License Number', 'Physician License'],
      expirationLabels: ['Expiration Date', 'Renewal Due'],
      watermarkExpected: true,
      sealLocation: 'TOP_RIGHT',
      barcodeZone: 'bottom-center',
    },
  },
  {
    templateType: 'TX_MSBME',
    matchers: [/TEXAS MEDICAL BOARD/i, /AUSTIN,\s*TX/i],
    parsingConfig: {
      licenseLabels: ['License #', 'Board License'],
      expirationLabels: ['Expires', 'Renewal'],
      watermarkExpected: false,
      sealLocation: 'BOTTOM_RIGHT',
    },
  },
  {
    templateType: 'FL_DOH',
    matchers: [/STATE OF FLORIDA/i, /DEPARTMENT OF HEALTH/i],
    parsingConfig: {
      licenseLabels: ['License Number', 'License ID'],
      expirationLabels: ['Valid Thru', 'Expiration'],
      watermarkExpected: true,
      barcodeZone: 'top-left',
    },
  },
  {
    templateType: 'NY_OP',
    matchers: [/NEW YORK STATE\s+EDUCATION DEPARTMENT/i, /OFFICE OF THE PROFESSIONS/i],
    parsingConfig: {
      licenseLabels: ['Registration Number', 'License Number'],
      expirationLabels: ['Registration Expires', 'Expires'],
      watermarkExpected: true,
      sealLocation: 'BOTTOM_LEFT',
    },
  },
  {
    templateType: 'WA_DOH',
    matchers: [/WASHINGTON STATE\s+DEPARTMENT OF HEALTH/i, /OLYMPIA,?\s+WA/i],
    parsingConfig: {
      licenseLabels: ['Credential Number', 'License Credential'],
      expirationLabels: ['Expiration Date', 'Effective Through'],
      watermarkExpected: false,
      barcodeZone: 'top-right',
    },
  },
];

const BOARD_KEYWORDS = [
  'STATE OF',
  'DEPARTMENT OF HEALTH',
  'MEDICAL BOARD',
  'ISSUED BY',
  'DIGITALLY SIGNED',
];

const SCANNED_KEYWORDS = ['scanned copy', 'faxed', 'upload', 'dpi', 'image', 'scan'];

const DEFAULT_CONFIG: TemplateParsingConfig = {
  licenseLabels: ['License Number'],
  expirationLabels: ['Expiration Date'],
  watermarkExpected: false,
};

export function detectLicenseTemplate(input: TemplateDetectionInput): TemplateDetectionResult {
  const text = input.text ?? '';
  const upperText = text.toUpperCase();

  let selectedRule: TemplateRule | undefined;
  let matchedPhrases: string[] = [];

  for (const rule of TEMPLATE_RULES) {
    const hits = rule.matchers.filter((matcher) => matcher.test(text));
    if (hits.length === rule.matchers.length) {
      selectedRule = rule;
      matchedPhrases = hits.map((hit) => hit.source);
      break;
    }
    if (!selectedRule && hits.length > 0) {
      selectedRule = rule;
      matchedPhrases = hits.map((hit) => hit.source);
    }
  }

  const templateType = selectedRule?.templateType ?? 'UNKNOWN';
  const parsingConfig = selectedRule?.parsingConfig ?? DEFAULT_CONFIG;
  const confidence = computeConfidence(selectedRule, matchedPhrases.length);
  const sourceType = detectSourceType(upperText, input.metadata);

  return {
    templateType,
    sourceType,
    confidence,
    parsingConfig,
    matchedPhrases,
  };
}

function computeConfidence(rule: TemplateRule | undefined, matchedCount: number): number {
  if (!rule) return 0.35;
  const ratio = matchedCount / rule.matchers.length;
  return Math.min(1, Math.max(0.4, ratio));
}

function detectSourceType(
  uppercaseText: string,
  metadata?: TemplateDetectionInput['metadata']
): TemplateSourceType {
  if (metadata?.source) {
    return metadata.source;
  }

  if (metadata?.mimeType?.includes('pdf') || metadata?.hasVectorText) {
    return 'BOARD_PDF';
  }

  const boardHits = BOARD_KEYWORDS.filter((keyword) => uppercaseText.includes(keyword)).length;
  const scanHits = SCANNED_KEYWORDS.filter((keyword) =>
    uppercaseText.includes(keyword.toUpperCase())
  ).length;

  if (boardHits === 0 && scanHits === 0) {
    return 'BOARD_PDF';
  }

  return boardHits >= scanHits ? 'BOARD_PDF' : 'SCANNED_COPY';
}











