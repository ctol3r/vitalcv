import fetch from 'node-fetch';
import { XMLParser } from 'fast-xml-parser';
import fs from 'fs';

const TL_URL = process.env.EU_TL_URL || 'https://esignature.ec.europa.eu/efda/tl-browser/api/v1/lotl/download';

export async function syncTrustedList() {
  const r = await fetch(TL_URL);
  const xml = await r.text();
  const j = new XMLParser({ ignoreAttributes: false }).parse(xml);

  // Very light extractor (schemas vary). We store a minimal summary + raw snapshot size.
  const providers = (j?.TrustServiceStatusList?.TrustServiceProviderList?.TrustServiceProvider || []);
  const template = 'ETSI TS119612 v2.4.1';
  let qualified = 0, nonqualified = 0;
  const warnings: string[] = [];

  for (const p of providers) {
    const services = p?.TSPServices?.TSPService || [];
    for (const s of ([] as any[]).concat(services)) {
      const isQualified = /qualified/i.test(JSON.stringify(s));
      if (isQualified) qualified++; else nonqualified++;

      // naive checks: accreditation / risk policy presence
      const hasAccred = /EN\s*319403|17065|accredit/i.test(JSON.stringify(s));
      const hasRisk = /risk|policy/i.test(JSON.stringify(s));

      if (isQualified && !hasAccred) {
        warnings.push(`qualified service missing accreditation → ${p?.TSPInformation?.TSPName?.Name || 'provider'}`);
      }
      if (!isQualified && !hasRisk) {
        warnings.push(`non-qualified service missing risk policy → ${p?.TSPInformation?.TSPName?.Name || 'provider'}`);
      }
    }
  }

  const snap = {
    template,
    fetched_at: new Date().toISOString(),
    raw_size: xml.length,
    provider_count: providers.length || 0,
    qualified_count: qualified,
    nonqualified_count: nonqualified,
    warnings
  };

  fs.writeFileSync('trusted_list_snapshot.json', JSON.stringify(snap, null, 2));
  return snap;
}

export function readTrustedList() {
  try {
    return JSON.parse(fs.readFileSync('trusted_list_snapshot.json', 'utf8'));
  } catch {
    return null;
  }
}

