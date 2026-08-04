/**
 * FsmbPdcAdapter — FSMB Physician Data Center route for physicians, osteopathic
 * physicians and PAs.
 *
 * STATE: not activated. There is no executed FSMB institutional agreement and
 * no production credentials, so `isConfigured()` is false and every lookup
 * returns ACCESS_NOT_ESTABLISHED.
 *
 * The response mapping below is deliberately absent rather than guessed. The
 * PDC response schema is published to contracted institutions, and writing a
 * parser against an imagined shape would produce exactly the failure this
 * program forbids: a fixture that looks like a source run. When the agreement
 * lands, `mapResponse` gets implemented against recorded real responses, and
 * the runtime state flips only after a production run actually succeeds.
 *
 * Reference: https://www.fsmb.org/PDC/pdc-data-files/ and
 *            https://www.fsmb.org/PDC/pdc-query/
 */

import type { Jurisdiction, LicensureRouteKind, Profession } from '../types';
import {
  gap,
  type LicensureAdapter,
  type LicensureLookupRequest,
  type LicensureLookupResult,
} from './adapterContract';

const SUPPORTED: readonly Profession[] = ['PHYSICIAN_MD', 'PHYSICIAN_DO', 'PHYSICIAN_ASSISTANT'];

export interface FsmbPdcConfig {
  readonly baseUrl: string | null;
  readonly apiKey: string | null;
  /**
   * Set only when FSMB's permitted-use terms have been reviewed and accepted
   * for this deployment. Credentials alone do not authorize a call.
   */
  readonly termsAccepted: boolean;
}

export function fsmbConfigFromEnv(env: NodeJS.ProcessEnv): FsmbPdcConfig {
  return {
    baseUrl: env.FSMB_PDC_BASE_URL ?? null,
    apiKey: env.FSMB_PDC_API_KEY ?? null,
    termsAccepted: env.FSMB_PDC_TERMS_ACCEPTED === 'true',
  };
}

export class FsmbPdcAdapter implements LicensureAdapter {
  readonly sourceId = 'FSMB_PDC';
  readonly routeKind: LicensureRouteKind = 'NATIONAL';

  constructor(private readonly config: FsmbPdcConfig) {}

  supports(profession: Profession, _jurisdiction: Jurisdiction): boolean {
    return SUPPORTED.includes(profession);
  }

  isConfigured(): boolean {
    return (
      this.config.baseUrl !== null &&
      this.config.apiKey !== null &&
      this.config.termsAccepted
    );
  }

  async lookup(request: LicensureLookupRequest, now: Date): Promise<LicensureLookupResult> {
    if (!this.supports(request.profession, request.jurisdiction)) {
      return gap(
        this.sourceId,
        this.routeKind,
        'ACCESS_NOT_ESTABLISHED',
        `FSMB PDC does not cover ${request.profession}.`,
        now,
      );
    }

    if (!this.isConfigured()) {
      return gap(
        this.sourceId,
        this.routeKind,
        'ACCESS_NOT_ESTABLISHED',
        'FSMB Physician Data Center access is not established. An executed institutional agreement, production credentials and an accepted permitted-use review are all required before this route can run.',
        now,
      );
    }

    // Unreachable in the current build: isConfigured() cannot be true without
    // the three env values, and the response mapping is not written yet.
    // Failing closed here is intentional — this must never become a silent
    // success path if someone sets the env vars before L2 lands.
    return gap(
      this.sourceId,
      this.routeKind,
      'RESPONSE_UNRECOGNIZED',
      'FSMB PDC credentials are present but the production response mapping has not been implemented and validated. Refusing to interpret a response shape that has not been recorded from the real source.',
      now,
    );
  }
}
