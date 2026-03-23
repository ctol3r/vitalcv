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

  if (input.blockers.some((blocker) => blocker.toLowerCase().includes('pecos enrollment not found'))) {
    const action = buildAction(
      'resolve-pecos-enrollment',
      'Resolve PECOS enrollment',
      'Confirm CMS Medicare enrollment against the current quarterly PECOS release before proceeding.',
      'HIGH',
    );
    if (!seen.has(action.id)) {
      seen.add(action.id);
      actions.push(action);
    }
  }

  if (input.gaps.some((gap) => gap.toLowerCase().includes('stale'))) {
    const action = buildAction(
      'refresh-stale-data',
      'Refresh stale sources',
      'Re-run stale source checks to restore freshness and keep readiness current.',
      'MEDIUM',
    );
    if (!seen.has(action.id)) {
      seen.add(action.id);
      actions.push(action);
    }
  }

  if (actions.length === 0) {
    actions.push(buildAction(
      'share-ready-passport',
      'Share with an employer',
      'All blocking items are clear. The next best step is to share the passport or apply.',
      'LOW',
    ));
  }

  return actions.slice(0, 4);
}
