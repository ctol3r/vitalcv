import { describe, expect, it } from 'vitest';

import {
  getRemediationHint,
  needsRemediationHint,
} from '@/lib/source-health/remediationHints';

const BANNED_PHRASES = [
  /automatically verified/i,
  /guaranteed verification/i,
  /\bcomplete credentialing\b/i,
  /instant credentialing/i,
  /legally accepted/i,
  /risk transferred/i,
  /HIPAA compliant/i,
  /SOC ?2 certified/i,
  /NCQA certified/i,
  /certified compliant/i,
  /final verification without review/i,
  /source confirmed before response/i,
];

/** Ensure no hint copy contains a truth-contract banned phrase or a bare-Verified marker. */
function assertCleanCopy(copy: string, label: string) {
  for (const re of BANNED_PHRASES) {
    expect(copy, `${label}: matched banned phrase ${re}`).not.toMatch(re);
  }
  // No bare "Verified" attribute pattern.
  expect(copy, `${label}: contains a "Verified" status label`).not.toMatch(
    /(label|status)\s*[:=]\s*['"]Verified['"]/,
  );
}

describe('getRemediationHint — coverageState precedence', () => {
  it('returns null when lane is healthy + decision-grade', () => {
    expect(
      getRemediationHint({ operatorStatus: 'HEALTHY', coverageState: 'checked' }),
    ).toBeNull();
    expect(needsRemediationHint({ operatorStatus: 'HEALTHY', coverageState: 'checked' })).toBe(false);
  });

  it('gated wins over operatorStatus — even CRITICAL surfaces gated copy first', () => {
    const h = getRemediationHint({ operatorStatus: 'CRITICAL', coverageState: 'gated' });
    expect(h?.rule).toBe('gated');
    expect(h?.tone).toBe('warn');
    expect(h?.copy).toMatch(/Institutional access required/i);
    // The copy does not blame the clinician.
    expect(h?.copy).not.toMatch(/clinician/i);
  });

  it('unavailable surfaces a critical-tone "not decision-grade" hint', () => {
    const h = getRemediationHint({ operatorStatus: 'HEALTHY', coverageState: 'unavailable' });
    expect(h?.rule).toBe('unavailable');
    expect(h?.tone).toBe('critical');
    expect(h?.copy).toMatch(/decision-grade/i);
  });

  it('CRITICAL operatorStatus with no coverage hint shows critical probe copy', () => {
    const h = getRemediationHint({ operatorStatus: 'CRITICAL', coverageState: 'checked' });
    expect(h?.rule).toBe('critical');
    expect(h?.tone).toBe('critical');
    expect(h?.copy).toMatch(/probe failing/i);
  });

  it('accessRequired surfaces the operator-credential next step', () => {
    const h = getRemediationHint({ operatorStatus: 'HEALTHY', coverageState: 'accessRequired' });
    expect(h?.rule).toBe('access_required');
    expect(h?.copy).toMatch(/credentials/i);
  });

  it('reviewRequired surfaces a manual-review next step', () => {
    const h = getRemediationHint({ operatorStatus: 'HEALTHY', coverageState: 'reviewRequired' });
    expect(h?.rule).toBe('review_required');
    expect(h?.copy).toMatch(/operator review/i);
  });

  it('DEGRADED operatorStatus surfaces the failures-investigation hint', () => {
    const h = getRemediationHint({ operatorStatus: 'DEGRADED', coverageState: 'checked' });
    expect(h?.rule).toBe('degraded');
    expect(h?.copy).toMatch(/probe failures/i);
  });

  it('STALE surfaces the refresh-or-route copy whether from operatorStatus or coverageState', () => {
    const fromOperator = getRemediationHint({ operatorStatus: 'STALE', coverageState: 'checked' });
    const fromCoverage = getRemediationHint({ operatorStatus: 'HEALTHY', coverageState: 'stale' });
    for (const h of [fromOperator, fromCoverage]) {
      expect(h?.rule).toBe('stale');
      expect(h?.copy).toMatch(/Refresh source probe/i);
    }
  });

  it('pending / notDecisionGrade / previewOnly all surface info-tone hints, never decision-grade', () => {
    const pending = getRemediationHint({ coverageState: 'pending' });
    const notDg = getRemediationHint({ coverageState: 'notDecisionGrade' });
    const preview = getRemediationHint({ coverageState: 'previewOnly' });

    for (const h of [pending, notDg, preview]) {
      expect(h?.tone).toBe('info');
    }
    expect(notDg?.copy).toMatch(/Do not treat as decision-grade/i);
    expect(preview?.copy).toMatch(/Preview/i);
  });

  it('no hint copy uses any truth-contract banned phrase or bare-Verified', () => {
    const inputs = [
      { operatorStatus: 'CRITICAL' as const },
      { operatorStatus: 'DEGRADED' as const },
      { operatorStatus: 'STALE' as const },
      { coverageState: 'gated' as const },
      { coverageState: 'unavailable' as const },
      { coverageState: 'accessRequired' as const },
      { coverageState: 'reviewRequired' as const },
      { coverageState: 'stale' as const },
      { coverageState: 'pending' as const },
      { coverageState: 'notDecisionGrade' as const },
      { coverageState: 'previewOnly' as const },
    ];
    for (const input of inputs) {
      const h = getRemediationHint(input);
      if (h) assertCleanCopy(h.copy, JSON.stringify(input));
    }
  });

  it('returns the same hint instance regardless of unrelated sourceId variations', () => {
    const a = getRemediationHint({ sourceId: 'NPPES_API', coverageState: 'gated' });
    const b = getRemediationHint({ sourceId: 'STATE_BOARD', coverageState: 'gated' });
    expect(a).toEqual(b);
  });
});
