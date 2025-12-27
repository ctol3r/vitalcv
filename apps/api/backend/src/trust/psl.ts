export type PreferredSourceEntry = {
  issuerDid?: string;
  orgId?: string;
};

export type PreferredSourceList = Record<string, PreferredSourceEntry[]>;

const DEFAULT_PSL: PreferredSourceList = {
  'verifier:demo-hospital': [
    { issuerDid: 'did:web:vitalcv.demo' },
    { issuerDid: 'VitalCV Demo Issuer (Non-PHI)' },
    { orgId: 'org:vitalcv-demo' },
  ],
  default: [{ issuerDid: 'did:web:vitalcv.demo' }],
};

function parsePreferredSourceList(raw: string): PreferredSourceList | null {
  try {
    const parsed = JSON.parse(raw) as PreferredSourceList;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function loadPreferredSourceList(): PreferredSourceList {
  const raw = String(process.env.PSL_CONFIG_JSON || '').trim();
  if (!raw) return DEFAULT_PSL;
  const parsed = parsePreferredSourceList(raw);
  if (!parsed) return DEFAULT_PSL;
  return parsed;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function getPreferredSources(verifierId: string): PreferredSourceEntry[] {
  if (!verifierId) return DEFAULT_PSL.default ?? [];
  const list = loadPreferredSourceList();
  return list[verifierId] ?? list.default ?? [];
}

export function isPreferredSource(issuerDid: string, verifierId: string): boolean {
  if (!issuerDid || !verifierId) return false;
  const normalizedIssuer = normalize(issuerDid);
  const sources = getPreferredSources(verifierId);
  return sources.some((source) => {
    const candidate = source.issuerDid || source.orgId || '';
    return normalize(candidate) === normalizedIssuer;
  });
}
