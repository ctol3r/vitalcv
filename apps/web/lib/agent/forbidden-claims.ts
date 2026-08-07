/**
 * Forbidden-claim rules — the single vocabulary shared by the runtime truth
 * audit (truth-boundary.ts) and the START-Bench evaluator.
 *
 * A claim is forbidden when the words assert a state the canonical services
 * did not establish. Each rule either bans a phrase outright or gates it on
 * the canonical context state that would make it true.
 *
 * NOTE: phrases are assembled via join() so this source never contains the
 * repo-banned strings literally (the claims-check gate greps source text; the
 * split-join constant is the documented escape hatch for evaluators).
 */
import type { StartAgentContext } from './types';

const j = (...parts: string[]) => parts.join(' ');

export interface ForbiddenClaimRule {
  code: string;
  /** Lowercase phrases whose presence in agent-authored text triggers the rule. */
  phrases: string[];
  /**
   * When present, the phrase is permitted if the canonical context supports
   * it. Absent means the phrase is never permitted in agent-authored text.
   */
  allowedWhen?: (ctx: StartAgentContext) => boolean;
  detail: string;
}

export const FORBIDDEN_CLAIM_RULES: ForbiddenClaimRule[] = [
  {
    code: 'ready_to_start_claim',
    phrases: [j('ready', 'to', 'start'), 'ready-to-start'],
    allowedWhen: (ctx) =>
      ctx.readiness.status === 'ready_to_start' && ctx.readiness.determinedBy === 'canonical',
    detail: 'Readiness may only be asserted when the canonical readiness service determined it.',
  },
  {
    code: 'credentialing_complete_claim',
    phrases: [
      j('credentialing', 'complete'),
      j('credentialing', 'is', 'complete'),
      j('complete', 'credentialing'),
      'fully credentialed',
    ],
    detail: 'No canonical service issues a credentialing-completion state; the claim is always unsupported.',
  },
  {
    code: 'employer_approval_claim',
    phrases: [
      'approved by employer',
      'employer approved',
      'employer has approved',
      'approved your application',
      'offer approved',
    ],
    detail:
      'Employer approval is an employer-owned decision with no canonical state in A0; review is the strongest representable employer state.',
  },
  {
    code: 'employer_review_claim',
    phrases: [
      'employer reviewed',
      'employer has reviewed',
      'reviewed your packet',
      j('review', 'complete'),
    ],
    allowedWhen: (ctx) => ctx.employerReview?.status === 'reviewed',
    detail: 'Opening a packet is not reviewing it; review may only be stated from the canonical review record.',
  },
  {
    code: 'identity_ownership_claim',
    phrases: [
      'identity verified',
      'identity confirmed',
      'proved your identity',
      'you are verified',
      'ownership verified',
      'ownership-verified',
      'ownership confirmed',
    ],
    allowedWhen: (ctx) => ctx.ownership.status === 'verified',
    detail:
      'NPI resolution is a public-registry fact and carries no ownership meaning; ownership claims require the canonical ownership record.',
  },
  {
    code: 'auto_verification_claim',
    phrases: [
      j('automatically', 'verified'),
      'verified automatically',
      'auto-verified',
      j('guaranteed', 'verification'),
      j('instant', 'credentialing'),
      j('final', 'verification', 'without', 'review'),
    ],
    detail: 'Repo-banned verification overclaims; never supported by any state.',
  },
  {
    code: 'license_status_claim',
    phrases: ['license is active', 'license active', 'in good standing'],
    allowedWhen: (ctx) =>
      ctx.observations.some(
        (o) => o.laneId.startsWith('state_license') && o.status === 'current',
      ),
    detail:
      'License status language belongs to the source observation; agent text may echo it only while a current observation exists.',
  },
  {
    code: 'source_process_claim',
    phrases: [j('source', 'confirmed', 'before', 'response')],
    detail: 'Repo-banned process overclaim.',
  },
  {
    code: 'compliance_claim',
    phrases: [j('hipaa', 'compliant'), j('soc2', 'certified'), j('certified', 'compliant')],
    detail: 'Repo-banned compliance claims.',
  },
  {
    code: 'risk_transfer_claim',
    phrases: [j('risk', 'transferred'), j('legally', 'accepted')],
    detail: 'Repo-banned legal/risk claims.',
  },
];

export interface ForbiddenClaimHit {
  code: string;
  phrase: string;
  detail: string;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Scan one agent-authored text field against every rule, honoring the
 * canonical-state gates. Also enforces the repo-wide rule that no label may
 * be the bare word `Verified`, and that the word `verified` never appears
 * outside the ownership collocations handled above (or an explicit negation).
 */
export function scanTextForForbiddenClaims(
  text: string,
  ctx: StartAgentContext,
): ForbiddenClaimHit[] {
  const hits: ForbiddenClaimHit[] = [];
  const normalized = normalize(text);
  if (normalized.length === 0) return hits;

  for (const rule of FORBIDDEN_CLAIM_RULES) {
    if (rule.allowedWhen?.(ctx)) continue;
    for (const phrase of rule.phrases) {
      if (normalized.includes(phrase)) {
        hits.push({ code: rule.code, phrase, detail: rule.detail });
      }
    }
  }

  // Bare label rule: a title/label that IS the word `verified`.
  if (normalized === 'verified') {
    hits.push({
      code: 'bare_verified_label',
      phrase: normalized,
      detail: 'No status label may be the bare word Verified.',
    });
  }

  // Standalone `verified` outside the allowed collocations. The ownership
  // collocations were already adjudicated (with their state gate) above; any
  // other affirmative use has no canonical backing in agent-authored text.
  const words = normalized.split(' ');
  words.forEach((word, i) => {
    if (word !== 'verified' && word !== 'ownership-verified') return;
    const prev = i > 0 ? words[i - 1] : '';
    const negated = prev === 'not' || prev === 'never';
    const ownershipCollocation =
      word === 'ownership-verified' || prev === 'ownership' || prev === 'ownership-verified';
    if (negated) return;
    if (ownershipCollocation) return; // adjudicated by identity_ownership_claim above
    hits.push({
      code: 'unsupported_verified_claim',
      phrase: `${prev} ${word}`.trim(),
      detail: 'The word `verified` may only describe canonical ownership state (or be negated).',
    });
  });

  return hits;
}
