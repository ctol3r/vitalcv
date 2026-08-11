/**
 * CA DCA BreEZe PSV adapter.
 *
 * FAIL-CLOSED CONTRACT. This adapter previously did two unsafe things, the same
 * pair fixed in the FSMB and Nursys adapters — see
 * `adapters/__tests__/adapterFailClosed.test.ts`. It was missed by that sweep,
 * and unlike the NCCPA placeholders it is *wired*: registered in
 * adapterRegistry.ts and reached through `runDeltaScan` from
 * psvOrchestrator.ts. ACTIVE is mapped to `VERIFIED` in app.ts (line ~2708) and
 * counted into `readinessScore` in psvOrchestrator.ts (line ~27), so both
 * defects were load-bearing.
 *
 *   1. `normalize()` classified INACTIVE as ACTIVE. It tested
 *      `statusStr.includes('ACTIVE')` first, and `'INACTIVE'.includes('ACTIVE')`
 *      is true — so the `else if` arm for INACTIVE was unreachable dead code. A
 *      licence the board reports as INACTIVE was published as a verified active
 *      licence. 'NOT CURRENT' hit the same trap via `includes('CURRENT')`, and
 *      so did every compound the board emits (e.g. 'DELINQUENT-INACTIVE').
 *      Substring matching is now gone: only an exact, recognized status string
 *      can produce a definitive result.
 *
 *   2. It scraped the public DCA search surface with no credentials and no
 *      gate. The Nursys fix established that calling a public verification
 *      surface without an executed agreement is not a permitted route.
 *
 * DCA BreEZe does not differ from Nursys here — and this repo had already
 * ruled on it. The real, validated CA BreEZe integration lives in
 * `services/providers/connectors/caBreezeLiveLookup.ts` and ships dark behind
 * `STATE_BOARD_MODE=live`, explicitly pending "(a) the DCA public-search usage
 * decision is approved and (b) the parser has been validated against a real
 * BreEZe response". This adapter was a second, ungated path to the same source
 * that walked straight past that gate. It now honours the same one.
 *
 * NOT_FOUND is deliberately unreachable here. BreEZe search is name-based and
 * fuzzy — caBreezeLiveLookup.ts refuses to treat an empty result set as proof
 * of absence for exactly that reason, and this adapter has weaker grounds
 * still: it queries by NPI, which BreEZe does not index. Every non-affirmative
 * outcome is ERROR. "We could not read the source" is not "no licence exists".
 *
 * Prefer `caBreezeLiveLookup.ts` for real CA work. This adapter should be
 * retired into that path rather than grown; the endpoint it targets
 * (`/api/search/v1`, keyed by NPI, hardcoded to `licenseType=RN` for every
 * caller including physicians and PAs) does not match the surface the
 * validated parser reads.
 */
import { BasePsvAdapter } from '../baseAdapter';
import { getConnectorMode } from '../../providers/connectors/connectorFactory';
import type { PsvAdapterConfig } from '../types';

type NormalizedResult = {
  normalizedData: Record<string, unknown>;
  status: 'ACTIVE' | 'EXPIRED' | 'NOT_FOUND' | 'ERROR';
  licenseNumber?: string;
  state?: string;
  expiresAt?: string;
};

/**
 * The status vocabulary the validated BreEZe parser recognizes
 * (caBreezeLiveLookup.ts `normalizeRowStatus` / `toStateBoardStatus`), mapped
 * onto the four PsvArtifact statuses. Exact keys only — nothing is inferred by
 * substring, which is what produced the INACTIVE-reads-ACTIVE defect.
 *
 * Adverse and lapsed states never widen toward ACTIVE. SURRENDERED and REVOKED
 * are disciplinary rather than lapsed, but PsvArtifact has no REVOKED member;
 * they map to EXPIRED so they stay out of `readinessScore`, and the
 * board-reported text is preserved verbatim in `normalizedData` alongside an
 * `adverseAction` marker so the distinction is not lost downstream.
 */
const STATUS_MAP: Record<string, 'ACTIVE' | 'EXPIRED'> = {
  ACTIVE: 'ACTIVE',
  'ACTIVE IN RENEWAL': 'ACTIVE',
  INACTIVE: 'EXPIRED',
  EXPIRED: 'EXPIRED',
  LAPSED: 'EXPIRED',
  DELINQUENT: 'EXPIRED',
  CANCELLED: 'EXPIRED',
  CANCELED: 'EXPIRED',
  SURRENDERED: 'EXPIRED',
  REVOKED: 'EXPIRED',
};

/** Board-reported states that are disciplinary, not merely lapsed. */
const ADVERSE_STATUSES = new Set(['SURRENDERED', 'REVOKED']);

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

export class DcaBreezeAdapter extends BasePsvAdapter {
  readonly config: PsvAdapterConfig = {
    sourceId: 'dca-breeze',
    sourceDisplayName: 'DCA BreEZe',
    methodologyVersion: '1.1.0',
    baseUrl: process.env.DCA_BREEZE_API_URL ?? 'https://search.dca.ca.gov',
    timeout: 15_000,
    retryAttempts: 3,
  };

  supports(_npi: string): boolean { return true; }

  /**
   * Gated on the same switch as the validated CA BreEZe integration. Default
   * (unset) is sandbox, so no request is made.
   */
  private isConfigured(): boolean {
    return getConnectorMode('STATE_BOARD') === 'live';
  }

  protected async doFetch(npi: string): Promise<{ rawResponse: unknown; sourceUrl: string; responseTimeMs: number }> {
    const sourceUrl = `${this.config.baseUrl}/api/search/v1?licenseType=RN&q=${npi}`;

    if (!this.isConfigured()) {
      // No request is made. Scraping the public DCA verification surface
      // without an approved usage decision is not a permitted route.
      return {
        rawResponse: {
          accessNotEstablished: true,
          npi,
          note: 'DCA BreEZe access is gated on STATE_BOARD_MODE=live and an approved DCA public-search usage decision.',
        },
        sourceUrl,
        responseTimeMs: 0,
      };
    }

    const start = Date.now();
    try {
      const res = await fetch(sourceUrl, {
        signal: AbortSignal.timeout(this.config.timeout),
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        return {
          rawResponse: { sourceError: true, npi, httpStatus: res.status },
          sourceUrl,
          responseTimeMs: Date.now() - start,
        };
      }
      const text = await res.text();
      try {
        return { rawResponse: JSON.parse(text) as unknown, sourceUrl, responseTimeMs: Date.now() - start };
      } catch {
        // A non-JSON body (a WAF interstitial or an HTML page) is not a
        // licence record and must never read as one.
        return {
          rawResponse: { unparsed: true, npi, bodyPreview: text.slice(0, 200) },
          sourceUrl,
          responseTimeMs: Date.now() - start,
        };
      }
    } catch {
      return {
        rawResponse: { sourceError: true, npi, note: 'DCA BreEZe request failed.' },
        sourceUrl,
        responseTimeMs: Date.now() - start,
      };
    }
  }

  protected normalize(r: unknown): NormalizedResult {
    const rec = (r ?? {}) as Record<string, unknown>;

    // Every non-answer is ERROR. None of these mean "no licence exists", and
    // none may contribute an ACTIVE artifact to a readiness score.
    if (rec.accessNotEstablished || rec.sourceError || rec.unparsed || rec.stub) {
      return { normalizedData: rec, status: 'ERROR' };
    }

    const rawStatus = rec.licenseStatus ?? rec.status ?? rec.license_status;
    if (typeof rawStatus !== 'string') {
      return {
        normalizedData: { ...rec, mappingError: 'No recognized status field in DCA BreEZe response.' },
        status: 'ERROR',
      };
    }

    const key = rawStatus.trim().toUpperCase();
    const mapped = STATUS_MAP[key];
    if (!mapped) {
      return {
        normalizedData: { ...rec, mappingError: `Unrecognized DCA BreEZe status: ${rawStatus}` },
        status: 'ERROR',
      };
    }

    return {
      normalizedData: ADVERSE_STATUSES.has(key)
        ? { ...rec, adverseAction: true, boardReportedStatus: rawStatus }
        : rec,
      status: mapped,
      state: 'CA',
      licenseNumber: optionalString(rec.licenseNumber) ?? optionalString(rec.license_number),
      expiresAt: optionalString(rec.expirationDate) ?? optionalString(rec.expires_at),
    };
  }
}
