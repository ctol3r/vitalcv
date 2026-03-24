import type { PecosEnrollmentStatus } from '../identity/pecosContract';

export type ReadinessActionPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ReadinessNextAction {
  id: string;
  title: string;
  detail: string;
  priority: ReadinessActionPriority;
}

function buildAction(
  id: string,
  title: string,
  detail: string,
  priority: ReadinessActionPriority,
): ReadinessNextAction {
  return { id, title, detail, priority };
}

function actionForMissingDomain(domain: string): ReadinessNextAction {
  switch (domain) {
    case 'IDENTITY':
      return buildAction(
        'verify-identity',
        'Verify identity',
        'Refresh NPPES-backed identity evidence before sharing or applying.',
        'HIGH',
      );
    case 'LICENSURE':
      return buildAction(
        'refresh-licensure',
        'Refresh licensure proof',
        'Add a current state license artifact and receipt for the target role.',
        'HIGH',
      );
    case 'EXCLUSION_CHECK':
      return buildAction(
        'run-exclusion-check',
        'Run exclusion screening',
        'Complete an exclusion check so employers can see a current sanctions-clear proof chain.',
        'HIGH',
      );
    case 'MEDICARE_ENROLLMENT':
      return buildAction(
        'submit-pecos-enrollment',
        'Submit Medicare enrollment (PECOS)',
        'This provider is not found in CMS PECOS data. Submit an enrollment application at pecos.cms.hhs.gov. Estimated: 45–60 days.',
        'HIGH',
      );
    default:
      return buildAction(
        `resolve-${domain.toLowerCase()}`,
        `Resolve ${domain.toLowerCase()}`,
        `Add source-backed proof for ${domain.toLowerCase().replace(/_/g, ' ')}.`,
        'MEDIUM',
      );
  }
}

export function buildReadinessNextActions(input: {
  missingBlockingDomains: readonly string[];
  blockers: readonly string[];
  gaps: readonly string[];
  /** MS16-C: Direct PECOS status — used to generate eligibility actions without string matching */
  pecosEnrollmentStatus?: PecosEnrollmentStatus;
}): ReadinessNextAction[] {
  const actions: ReadinessNextAction[] = [];
  const seen = new Set<string>();

  for (const domain of input.missingBlockingDomains) {
    const action = actionForMissingDomain(domain);
    if (!seen.has(action.id)) {
      seen.add(action.id);
      actions.push(action);
    }
  }

  if (input.blockers.some((blocker) => blocker.toLowerCase().includes('proof missing'))) {
    const action = buildAction(
      'repair-proof-chain',
      'Repair missing proof chain',
      'Replace any credential that no longer has a valid artifact and receipt trail.',
      'HIGH',
    );
    if (!seen.has(action.id)) {
      seen.add(action.id);
      actions.push(action);
    }
  }

  if (input.blockers.some((blocker) => blocker.toLowerCase().includes('expired'))) {
    const action = buildAction(
      'renew-expired-credentials',
      'Renew expired credentials',
      'Renew expired credentials before the profile can move back to ready status.',
      'HIGH',
    );
    if (!seen.has(action.id)) {
      seen.add(action.id);
      actions.push(action);
    }
  }

  if (input.blockers.some((blocker) => blocker.toLowerCase().includes('review'))) {
    const action = buildAction(
      'resolve-review-queue',
      'Resolve review-required credentials',
      'Clear manual-review items so blocked credentials can become source-backed proof.',
      'MEDIUM',
    );
    if (!seen.has(action.id)) {
      seen.add(action.id);
      actions.push(action);
    }
  }

  if (input.blockers.some((blocker) => blocker.toLowerCase().includes('possible match'))) {
    const action = buildAction(
      'resolve-leie-review',
      'Resolve LEIE review',
      'Manually adjudicate the LEIE possible match before treating the clinician as clear or excluded.',
      'HIGH',
    );
    if (!seen.has(action.id)) {
      seen.add(action.id);
      actions.push(action);
    }
  }

  // MS16-C/D: PECOS enrollment — direct status check (preferred) + string fallback
  const pecosStatus = input.pecosEnrollmentStatus;
  const pecosNotFound =
    pecosStatus === 'NOT_FOUND'
    || input.blockers.some((blocker) =>
      /pecos enrollment not found|enrollment not found|medicare enrollment not found/i.test(blocker)
    );
  const pecosUnknown =
    pecosStatus === 'UNKNOWN'
    || pecosStatus === 'UNCHECKED'
    || input.gaps.some((gap) =>
      /pecos (enrollment (status unresolved|outcome unresolved|not yet checked|not verified)|evidence is mock)/i.test(gap)
    )
    || input.blockers.some((blocker) =>
      /enrollment status requires review|enrollment.*review/i.test(blocker)
    );

  if (pecosNotFound) {
    const action = buildAction(
      'submit-pecos-enrollment',
      'Submit Medicare enrollment (PECOS)',
      'This provider was not found in the quarterly CMS PECOS release. Apply at pecos.cms.hhs.gov if not enrolled, then confirm against a fresh quarterly release after approval.',
      'HIGH',
    );
    if (!seen.has(action.id)) {
      seen.add(action.id);
      actions.push(action);
    }
  } else if (pecosUnknown) {
    const action = buildAction(
      'verify-medicare-enrollment',
      'Verify Medicare enrollment status',
      'PECOS enrollment is unresolved. Run or refresh the quarterly PECOS check and verify directly if the source remains inconclusive. PECOS is not a real-time feed.',
      'MEDIUM',
    );
    if (!seen.has(action.id)) {
      seen.add(action.id);
      actions.push(action);
    }
  }

  if (input.gaps.some((gap) => {
    const normalized = gap.toLowerCase();
    return normalized.includes('stale') || normalized.includes('revalidation due');
  })) {
    const action = buildAction(
      'refresh-stale-data',
      'Refresh stale sources',
      'Refresh sources that are stale or nearing revalidation so readiness stays decision-grade.',
      'MEDIUM',
    );
    if (!seen.has(action.id)) {
      seen.add(action.id);
      actions.push(action);
    }
  }

  // ── Authority-specific blockers ────────────────────────────────────────────

  if (input.blockers.some(b => /board order|disciplin/i.test(b))) {
    const action = buildAction(
      'resolve-board-order',
      'Resolve board disciplinary order',
      'A board disciplinary order or action is on file. Contact the issuing state medical board directly. Employers will require a written explanation before proceeding.',
      'HIGH',
    );
    if (!seen.has(action.id)) { seen.add(action.id); actions.push(action); }
  }

  if (input.blockers.some(b => /license.*expired|expired.*license/i.test(b))) {
    const action = buildAction(
      'renew-license',
      'Renew expired license',
      'At least one state license has expired. Contact the issuing state board to renew before applying to roles requiring that license. Estimated: 2–6 weeks depending on state.',
      'HIGH',
    );
    if (!seen.has(action.id)) { seen.add(action.id); actions.push(action); }
  }

  if (input.gaps.some(g => /fsmb|nursys|authority.*not.*connected|source.*not.*connected/i.test(g))) {
    const action = buildAction(
      'authority-source-pending',
      'Authority source not yet connected',
      'License verification requires FSMB or Nursys institutional access. Your administrator must enable the integration before authority claims can be confirmed.',
      'MEDIUM',
    );
    if (!seen.has(action.id)) { seen.add(action.id); actions.push(action); }
  }

  if (input.blockers.some(b => /license.*not.*available|not.*available.*state/i.test(b))) {
    const action = buildAction(
      'verify-state-board-direct',
      'Verify license via state board directly',
      'This state does not participate in automated license verification. Contact the state licensing board directly or ask the clinician to provide a board-issued verification letter.',
      'MEDIUM',
    );
    if (!seen.has(action.id)) { seen.add(action.id); actions.push(action); }
  }

  if (actions.length === 0) {
    actions.push(buildAction(
      'share-ready-passport',
      'Share with an employer',
      'All blocking items are clear. The next best step is to share the passport or apply.',
      'LOW',
    ));
  }

  return actions.slice(0, 5);
}
