/**
 * PSV POLICY EVALUATION ENGINE
 *
 * Pure domain logic for evaluating PSV reports against policy.
 * NO side effects, NO network calls, deterministic output.
 */

import type {
  PSVCheckResult,
  PSVDecision,
  PSVFreshnessRule,
  PSVPolicy,
  PSVPolicyEvaluation,
  PSVReport,
  PSVSource,
  PSVStatus,
} from './psvContracts';
import { PSVDecision as Decision, PSV_SOURCE_VALUES } from './psvContracts';

/**
 * Evaluate PSV report against policy
 *
 * DETERMINISTIC: Same inputs always produce same output
 * NO SIDE EFFECTS: Pure function
 *
 * @param report - PSV report with all checks
 * @param policy - Policy to evaluate against
 * @returns Policy evaluation with decision and reasons
 */
export function evaluatePSV(report: PSVReport, policy: PSVPolicy): PSVPolicyEvaluation {
  const violations: PSVPolicyEvaluation['violations'] = [];
  const reasons: string[] = [];
  const sourceOrder = new Map(
    PSV_SOURCE_VALUES.map((source, index) => [source, index])
  );
  const orderedChecks = [...report.checks].sort((left, right) => {
    const leftOrder = sourceOrder.get(left.source);
    const rightOrder = sourceOrder.get(right.source);
    const leftRank = leftOrder ?? Number.POSITIVE_INFINITY;
    const rightRank = rightOrder ?? Number.POSITIVE_INFINITY;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.source.localeCompare(right.source);
  });

  // RULE 1: Block on any FAIL status (if policy requires)
  if (policy.blockOnAnyFail) {
    const failedChecks = orderedChecks.filter((check) => check.status === 'FAIL');
    if (failedChecks.length > 0) {
      failedChecks.forEach((check) => {
        violations.push({
          source: check.source,
          rule: 'blockOnAnyFail',
          description: `Failed check: ${check.source}`,
        });
        reasons.push(`BLOCKED: ${check.source} check failed with ${check.normalizedFindings.length} finding(s)`);
      });
      return {
        decision: Decision.BLOCK,
        reasons,
        violations,
      };
    }
  }

  // RULE 2: Review on any FLAG status (if policy requires)
  if (policy.reviewOnAnyFlag) {
    const flaggedChecks = orderedChecks.filter((check) => check.status === 'FLAG');
    if (flaggedChecks.length > 0) {
      flaggedChecks.forEach((check) => {
        violations.push({
          source: check.source,
          rule: 'reviewOnAnyFlag',
          description: `Flagged check: ${check.source}`,
        });
        reasons.push(`FLAGGED: ${check.source} requires manual review (${check.normalizedFindings.length} potential match(es))`);
      });
      return {
        decision: Decision.REVIEW,
        reasons,
        violations,
      };
    }
  }

  // RULE 3: Check for required sources
  const requiredSources = policy.freshnessRules.filter((rule) => rule.required).map((rule) => rule.source);
  const checkedSources = orderedChecks.map((check) => check.source);

  for (const requiredSource of requiredSources) {
    if (!checkedSources.includes(requiredSource)) {
      violations.push({
        source: requiredSource,
        rule: 'requiredSource',
        description: `Required source not checked: ${requiredSource}`,
      });
      reasons.push(`MISSING: Required source ${requiredSource} not checked`);
    }
  }

  // RULE 4: Check freshness for all checked sources
  const now = new Date(report.decidedAt);
  for (const check of orderedChecks) {
    const freshnessRule = policy.freshnessRules.find((rule) => rule.source === check.source);
    if (!freshnessRule) {
      continue; // No freshness rule for this source
    }

    const checkedAt = new Date(check.evidence.checkedAt);
    const ageSeconds = (now.getTime() - checkedAt.getTime()) / 1000;

    if (ageSeconds > freshnessRule.maxAgeSeconds) {
      violations.push({
        source: check.source,
        rule: 'freshness',
        description: `Check expired: ${check.source} (age: ${Math.floor(ageSeconds / 86400)} days, max: ${Math.floor(freshnessRule.maxAgeSeconds / 86400)} days)`,
      });
      reasons.push(
        `STALE: ${check.source} check is ${Math.floor(ageSeconds / 86400)} days old (max: ${Math.floor(
          freshnessRule.maxAgeSeconds / 86400
        )} days)`
      );
    }

    // Check explicit expiry
    if (check.evidence.expiresAt) {
      const expiresAt = new Date(check.evidence.expiresAt);
      if (now > expiresAt) {
        violations.push({
          source: check.source,
          rule: 'expiry',
          description: `Check expired: ${check.source}`,
        });
        reasons.push(`EXPIRED: ${check.source} check expired on ${check.evidence.expiresAt}`);
      }
    }
  }

  // RULE 5: Handle UNKNOWN sources (if policy disallows)
  if (!policy.allowUnknownSources) {
    const unknownChecks = orderedChecks.filter((check) => check.status === 'UNKNOWN');
    if (unknownChecks.length > 0) {
      unknownChecks.forEach((check) => {
        violations.push({
          source: check.source,
          rule: 'allowUnknownSources',
          description: `Unknown status not allowed: ${check.source}`,
        });
        reasons.push(`UNKNOWN: ${check.source} check returned unknown status`);
      });
    }
  }

  // RULE 6: Handle ERROR sources
  const errorChecks = orderedChecks.filter((check) => check.status === 'ERROR');
  if (errorChecks.length > 0) {
    errorChecks.forEach((check) => {
      violations.push({
        source: check.source,
        rule: 'error',
        description: `Error during check: ${check.source}`,
      });
      reasons.push(`ERROR: ${check.source} check encountered technical error`);
    });
  }

  // DECISION LOGIC
  if (violations.length > 0) {
    // Any violations require review (unless already blocked)
    return {
      decision: Decision.REVIEW,
      reasons,
      violations,
    };
  }

  // All checks passed, no violations
  reasons.push('All required sources checked and passed');
  return {
    decision: Decision.CLEAR,
    reasons,
    violations: [],
  };
}

/**
 * Check if a PSV check is fresh according to policy
 *
 * @param check - PSV check to evaluate
 * @param freshnessRule - Freshness rule for the source
 * @param asOf - Evaluation timestamp (ISO 8601)
 * @returns true if check is fresh, false otherwise
 */
export function isCheckFresh(check: PSVCheckResult, freshnessRule: PSVFreshnessRule, asOf: string): boolean {
  const now = new Date(asOf);
  const checkedAt = new Date(check.evidence.checkedAt);
  const ageSeconds = (now.getTime() - checkedAt.getTime()) / 1000;

  // Check age-based freshness
  if (ageSeconds > freshnessRule.maxAgeSeconds) {
    return false;
  }

  // Check explicit expiry
  if (check.evidence.expiresAt) {
    const expiresAt = new Date(check.evidence.expiresAt);
    if (now > expiresAt) {
      return false;
    }
  }

  return true;
}

/**
 * Get missing required sources from a report
 *
 * @param report - PSV report
 * @param policy - Policy to check against
 * @returns Array of required sources that are missing
 */
export function getMissingRequiredSources(report: PSVReport, policy: PSVPolicy): PSVSource[] {
  const requiredSources = policy.freshnessRules.filter((rule) => rule.required).map((rule) => rule.source);
  const checkedSources = report.checks.map((check) => check.source);

  return requiredSources.filter((source) => !checkedSources.includes(source));
}

/**
 * Get stale checks from a report
 *
 * @param report - PSV report
 * @param policy - Policy to check against
 * @returns Array of stale checks
 */
export function getStaleChecks(report: PSVReport, policy: PSVPolicy): PSVCheckResult[] {
  const staleChecks: PSVCheckResult[] = [];

  for (const check of report.checks) {
    const freshnessRule = policy.freshnessRules.find((rule) => rule.source === check.source);
    if (!freshnessRule) {
      continue;
    }

    if (!isCheckFresh(check, freshnessRule, report.decidedAt)) {
      staleChecks.push(check);
    }
  }

  return staleChecks;
}

/**
 * Create a PSV report from checks and policy evaluation
 *
 * @param subjectId - Subject identifier
 * @param checks - All PSV checks
 * @param policy - Policy to evaluate
 * @returns Complete PSV report with decision
 */
export function createPSVReport(
  subjectId: string,
  checks: PSVCheckResult[],
  policy: PSVPolicy,
  decidedAt: string = new Date().toISOString()
): PSVReport {
  const tempReport: PSVReport = {
    subjectId,
    checks,
    decision: Decision.REVIEW, // Temporary - will be overwritten
    decidedAt,
    reasons: [],
    policyVersion: policy.version,
  };

  const evaluation = evaluatePSV(tempReport, policy);

  return {
    ...tempReport,
    decision: evaluation.decision,
    reasons: evaluation.reasons,
  };
}
