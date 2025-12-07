import { createHash } from 'crypto';

import type { AuthorityCode, StateBoardRule, StateRuleSnapshot } from './types';

const STATE_RULE_BASE = process.env.REGULATORY_STATE_RULE_BASE?.replace(/\/$/, '');

export interface StateRuleOptions {
  states?: string[];
  signal?: AbortSignal;
  baseUrl?: string;
}

type RemoteStatePayload = Partial<StateRuleSnapshot>;

export async function scrapeStateBoardRules(
  authorityCode: AuthorityCode,
  options: StateRuleOptions = {},
): Promise<StateRuleSnapshot> {
  const baseUrl = options.baseUrl ?? STATE_RULE_BASE;
  if (baseUrl) {
    try {
      const payload = await queryRemote(baseUrl, authorityCode, options.states, options.signal);
      if (payload?.states?.length) {
        return {
          authorityCode,
          fetchedAt: payload.fetchedAt ?? new Date().toISOString(),
          source: payload.source ?? 'scraper',
          states: payload.states,
        };
      }
    } catch (error) {
      console.warn('[regulatory][state-rules] remote scraper failed, using synthetic snapshot', {
        authorityCode,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return buildSyntheticSnapshot(authorityCode, options.states);
}

async function queryRemote(
  baseUrl: string,
  authorityCode: AuthorityCode,
  states: string[] | undefined,
  signal?: AbortSignal,
): Promise<RemoteStatePayload | null> {
  const params = new URLSearchParams({
    authority: authorityCode,
  });
  if (states?.length) {
    params.set('states', states.join(','));
  }

  const response = await fetch(`${baseUrl}/regulatory/state-rules?${params.toString()}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`State rule scraper responded with ${response.status}`);
  }

  return (await response.json()) as RemoteStatePayload;
}

function buildSyntheticSnapshot(
  authorityCode: AuthorityCode,
  preferredStates?: string[],
): StateRuleSnapshot {
  const states = preferredStates?.length ? preferredStates : DEFAULT_STATE_SAMPLE;
  return {
    authorityCode,
    fetchedAt: new Date().toISOString(),
    source: 'synthetic',
    states: buildSyntheticStates(authorityCode, states),
  };
}

function buildSyntheticStates(authorityCode: AuthorityCode, states: string[]): StateBoardRule[] {
  return states.map((state, index) => {
    const hash = createHash('sha256').update(`${authorityCode}:${state}`).digest();
    const renewalWindowMonths = 24 - (hash[0] % 6) * 2;
    const telehealthFlexibility = deriveTelehealthFlexibility(hash[1]);
    const verificationLagDays = 10 + (hash[2] % 20);
    return {
      state,
      boardName: `${state} Board of Medicine`,
      renewalWindowMonths,
      telehealthFlexibility,
      verificationLagDays,
      sourceUrl: `https://rules.${authorityCode.toLowerCase()}.example/${state.toLowerCase()}`,
      lastObserved: new Date(Date.now() - index * 86_400_000).toISOString(),
      requiresCmeAudit: hash[3] % 3 === 0,
    };
  });
}

function deriveTelehealthFlexibility(byte: number): StateBoardRule['telehealthFlexibility'] {
  if (byte % 3 === 0) return 'full';
  if (byte % 3 === 1) return 'limited';
  return 'none';
}

const DEFAULT_STATE_SAMPLE = ['CA', 'NY', 'TX', 'WA', 'FL', 'IL'];









