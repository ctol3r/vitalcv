/**
 * Wave 12: ORCID integration adapter.
 *
 * Scaffolds the OAuth 2.0 flow for a clinician to link their ORCID iD,
 * and pulls publications + affiliations from the ORCID public/member API.
 *
 * OAuth flow:
 *   1. generateAuthUrl() → redirect clinician to ORCID authorize endpoint
 *   2. exchangeCode() → trade authorization code for access token + ORCID iD
 *   3. fetchProfile() → pull works + affiliations from ORCID API
 *
 * Zero PHI: only publication metadata and institutional affiliations are stored.
 */

import { log } from '../../obs/logger';
import type { OrcidProfile, OrcidWork, OrcidAffiliation } from '@vitalcv/domain-common';

const ORCID_SANDBOX = process.env.ORCID_SANDBOX === 'true';
const ORCID_BASE = ORCID_SANDBOX
  ? 'https://sandbox.orcid.org'
  : 'https://orcid.org';
const ORCID_API_BASE = ORCID_SANDBOX
  ? 'https://pub.sandbox.orcid.org/v3.0'
  : 'https://pub.orcid.org/v3.0';

const ORCID_CLIENT_ID = process.env.ORCID_CLIENT_ID ?? '';
const ORCID_CLIENT_SECRET = process.env.ORCID_CLIENT_SECRET ?? '';
const ORCID_REDIRECT_URI = process.env.ORCID_REDIRECT_URI ?? '';

const DEFAULT_TIMEOUT_MS = 15_000;

interface OrcidTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in: number;
  orcid: string;
  name?: string;
}

interface OrcidWorkSummary {
  title?: { title?: { value?: string } };
  type?: string;
  'publication-date'?: { year?: { value?: string }; month?: { value?: string }; day?: { value?: string } };
  'external-ids'?: {
    'external-id'?: Array<{
      'external-id-type'?: string;
      'external-id-value'?: string;
    }>;
  };
}

interface OrcidEmploymentSummary {
  organization?: { name?: string };
  'role-title'?: string;
  'start-date'?: { year?: { value?: string }; month?: { value?: string } };
  'end-date'?: { year?: { value?: string }; month?: { value?: string } };
}

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function formatOrcidDate(date?: { year?: { value?: string }; month?: { value?: string }; day?: { value?: string } }): string | undefined {
  if (!date?.year?.value) return undefined;
  const parts = [date.year.value];
  if (date.month?.value) parts.push(date.month.value.padStart(2, '0'));
  if (date.day?.value) parts.push(date.day.value.padStart(2, '0'));
  return parts.join('-');
}

export class OrcidAdapter {
  /**
   * Generate the ORCID OAuth authorization URL.
   * Redirect the clinician's browser to this URL to start the link flow.
   */
  generateAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: ORCID_CLIENT_ID,
      response_type: 'code',
      scope: '/authenticate /read-limited',
      redirect_uri: ORCID_REDIRECT_URI,
      state,
    });
    return `${ORCID_BASE}/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange an authorization code for an access token and ORCID iD.
   */
  async exchangeCode(code: string): Promise<{ accessToken: string; orcidId: string; displayName: string }> {
    const body = new URLSearchParams({
      client_id: ORCID_CLIENT_ID,
      client_secret: ORCID_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: ORCID_REDIRECT_URI,
    });

    const res = await fetchWithTimeout(`${ORCID_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'unknown');
      log('error', 'orcid_token_exchange_failed', { status: res.status, error: errorText });
      throw new Error(`ORCID token exchange failed: ${res.status}`);
    }

    const data = (await res.json()) as OrcidTokenResponse;

    return {
      accessToken: data.access_token,
      orcidId: data.orcid,
      displayName: data.name ?? '',
    };
  }

  /**
   * Fetch the clinician's ORCID profile including works and affiliations.
   */
  async fetchProfile(orcidId: string, accessToken: string, clinicianId: string): Promise<OrcidProfile> {
    const fetchedAt = new Date().toISOString();

    try {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      };

      // Fetch works and employments in parallel
      const [worksRes, employmentsRes] = await Promise.all([
        fetchWithTimeout(`${ORCID_API_BASE}/${orcidId}/works`, { headers }),
        fetchWithTimeout(`${ORCID_API_BASE}/${orcidId}/employments`, { headers }),
      ]);

      const works: OrcidWork[] = [];
      if (worksRes.ok) {
        const worksData = await worksRes.json() as { group?: Array<{ 'work-summary'?: OrcidWorkSummary[] }> };
        for (const group of worksData.group ?? []) {
          const summary = group['work-summary']?.[0];
          if (!summary?.title?.title?.value) continue;

          const externalIds = (summary['external-ids']?.['external-id'] ?? []).map((eid) =>
            Object.freeze({ type: eid['external-id-type'] ?? 'unknown', value: eid['external-id-value'] ?? '' }),
          );

          const doiEntry = externalIds.find((e) => e.type === 'doi');

          works.push(
            Object.freeze({
              title: summary.title.title.value,
              type: summary.type ?? 'other',
              publicationDate: formatOrcidDate(summary['publication-date']),
              doi: doiEntry?.value,
              externalIds,
            }),
          );
        }
      } else {
        log('warn', 'orcid_works_fetch_failed', { orcidId, status: worksRes.status });
      }

      const affiliations: OrcidAffiliation[] = [];
      if (employmentsRes.ok) {
        const empData = await employmentsRes.json() as {
          'affiliation-group'?: Array<{ summaries?: Array<{ 'employment-summary'?: OrcidEmploymentSummary }> }>;
        };
        for (const group of empData['affiliation-group'] ?? []) {
          const summary = group.summaries?.[0]?.['employment-summary'];
          if (!summary?.organization?.name) continue;

          affiliations.push(
            Object.freeze({
              organizationName: summary.organization.name,
              role: summary['role-title'] ?? '',
              startDate: formatOrcidDate(summary['start-date']),
              endDate: formatOrcidDate(summary['end-date']),
            }),
          );
        }
      } else {
        log('warn', 'orcid_employments_fetch_failed', { orcidId, status: employmentsRes.status });
      }

      return Object.freeze({
        clinicianId,
        orcidId,
        verificationStatus: 'VERIFIED' as const,
        displayName: '', // Populated by caller from token exchange
        works,
        affiliations,
        fetchedAt,
      });
    } catch (error) {
      log('error', 'orcid_profile_fetch_error', {
        orcidId,
        clinicianId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Convenience: link account + fetch profile in one step.
   */
  async linkAccount(
    code: string,
    clinicianId: string,
  ): Promise<OrcidProfile> {
    const { accessToken, orcidId, displayName } = await this.exchangeCode(code);
    const profile = await this.fetchProfile(orcidId, accessToken, clinicianId);

    return Object.freeze({
      ...profile,
      displayName,
    });
  }
}
