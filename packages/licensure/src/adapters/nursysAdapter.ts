/**
 * NursysAdapter — Nursys/NCSBN route for RNs, LPN/VNs and APRNs.
 *
 * STATE: not activated. No NCSBN institutional agreement and no production
 * credentials, so `isConfigured()` is false and every lookup returns
 * ACCESS_NOT_ESTABLISHED.
 *
 * Two hazards this adapter is written to avoid, both of which are live in the
 * legacy `apps/api/backend/src/services/psv-adapters/adapters/nursysAdapter.ts`:
 *
 *   1. Scraping the public Nursys verification page without an agreement. This
 *      adapter makes no HTTP call at all while unconfigured.
 *   2. Treating an unparsed response as an ACTIVE license. There is no code
 *      path here that produces a status without a validated mapping.
 *
 * A Nursys result is an aggregation across participating boards of nursing. If
 * and when mapping is implemented, each returned record must carry the
 * originating board — `LicensureObservation.originatingAuthorityId` is
 * required, so a record cannot be attributed to "Nursys" alone.
 *
 * Reference: https://ncsbn.org/nursing-regulation/licensure/license-verification.page
 */

import type { Jurisdiction, LicensureRouteKind, Profession } from '../types';
import {
  gap,
  type LicensureAdapter,
  type LicensureLookupRequest,
  type LicensureLookupResult,
} from './adapterContract';

const SUPPORTED: readonly Profession[] = ['RN', 'LPN_VN', 'APRN'];

export interface NursysConfig {
  readonly baseUrl: string | null;
  readonly clientId: string | null;
  readonly clientSecret: string | null;
  readonly termsAccepted: boolean;
}

export function nursysConfigFromEnv(env: NodeJS.ProcessEnv): NursysConfig {
  return {
    baseUrl: env.NURSYS_BASE_URL ?? null,
    clientId: env.NURSYS_CLIENT_ID ?? null,
    clientSecret: env.NURSYS_CLIENT_SECRET ?? null,
    termsAccepted: env.NURSYS_TERMS_ACCEPTED === 'true',
  };
}

export class NursysAdapter implements LicensureAdapter {
  readonly sourceId = 'NURSYS';
  readonly routeKind: LicensureRouteKind = 'NATIONAL';

  constructor(private readonly config: NursysConfig) {}

  supports(profession: Profession, _jurisdiction: Jurisdiction): boolean {
    return SUPPORTED.includes(profession);
  }

  isConfigured(): boolean {
    return (
      this.config.baseUrl !== null &&
      this.config.clientId !== null &&
      this.config.clientSecret !== null &&
      this.config.termsAccepted
    );
  }

  async lookup(request: LicensureLookupRequest, now: Date): Promise<LicensureLookupResult> {
    if (!this.supports(request.profession, request.jurisdiction)) {
      return gap(
        this.sourceId,
        this.routeKind,
        'ACCESS_NOT_ESTABLISHED',
        `Nursys does not cover ${request.profession}.`,
        now,
      );
    }

    if (!this.isConfigured()) {
      return gap(
        this.sourceId,
        this.routeKind,
        'ACCESS_NOT_ESTABLISHED',
        'Nursys/NCSBN access is not established. An executed institutional agreement, production credentials and an accepted permitted-use review are all required before this route can run.',
        now,
      );
    }

    return gap(
      this.sourceId,
      this.routeKind,
      'RESPONSE_UNRECOGNIZED',
      'Nursys credentials are present but the production response mapping has not been implemented and validated. Refusing to interpret a response shape that has not been recorded from the real source.',
      now,
    );
  }
}
