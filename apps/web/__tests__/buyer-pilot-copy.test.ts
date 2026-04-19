import { describe, expect, it } from 'vitest';
import {
  ALLOWED_CTA_VERBS,
  BANNED_BUYER_PHRASES,
  BUYER_PILOT_CTA,
  BUYER_PILOT_KPI_COPY,
  BUYER_PILOT_LIMITATIONS,
  containsBannedBuyerPhrase,
  isAllowedCtaVerb,
} from '@/lib/pilot/buyer-pilot-copy';

function collectAllBuyerCopy(): string {
  const cta = BUYER_PILOT_CTA;
  const chunks: string[] = [
    cta.headline,
    cta.description,
    cta.primaryActionLabel,
    ...Object.values(cta.answers),
    BUYER_PILOT_KPI_COPY.sectionHeadline,
    BUYER_PILOT_KPI_COPY.sectionDescription,
    BUYER_PILOT_KPI_COPY.emptyStateNote,
    BUYER_PILOT_KPI_COPY.partialStateNote,
    ...Object.values(BUYER_PILOT_KPI_COPY.tileMeta).flatMap((t) => [t.label, t.readsFrom]),
    ...BUYER_PILOT_LIMITATIONS,
  ];
  return chunks.join(' \n ');
}

describe('BUYER_PILOT_CTA — answers every required buyer question', () => {
  it('answers all five Lane D questions with non-empty strings', () => {
    const { answers } = BUYER_PILOT_CTA;
    expect(answers.whatHappensOnRequest.trim().length).toBeGreaterThan(0);
    expect(answers.whatWeMeasure.trim().length).toBeGreaterThan(0);
    expect(answers.whatYouProvide.trim().length).toBeGreaterThan(0);
    expect(answers.successCriteria.trim().length).toBeGreaterThan(0);
    expect(answers.outsideCurrentCoverage.trim().length).toBeGreaterThan(0);
  });

  it('whatHappensOnRequest is concrete — contains a timeframe or a commitment', () => {
    const text = BUYER_PILOT_CTA.answers.whatHappensOnRequest.toLowerCase();
    // Must name either a day window, a business-day commitment, a scope doc,
    // or another concrete boundary. Rules out "we'll be in touch" vagueness.
    const concreteMarkers = /(day|week|business|scope|signed|within|reply)/;
    expect(text).toMatch(concreteMarkers);
  });

  it('outsideCurrentCoverage names specific sources that are NOT integrated', () => {
    const text = BUYER_PILOT_CTA.answers.outsideCurrentCoverage.toUpperCase();
    // At least two of these well-known sources must be named.
    const sourceMentions = ['NPDB', 'DEA', 'ABMS', 'CAQH', 'SAM.GOV', 'PECOS'];
    const mentioned = sourceMentions.filter((s) => text.includes(s));
    expect(mentioned.length).toBeGreaterThanOrEqual(2);
  });

  it('whatWeMeasure names the startability chain explicitly', () => {
    const text = BUYER_PILOT_CTA.answers.whatWeMeasure.toLowerCase();
    expect(text).toContain('submit');
    expect(text).toContain('first view');
    expect(text).toContain('start-ready');
  });

  it('primary CTA verb is in the approved allowlist', () => {
    expect(isAllowedCtaVerb(BUYER_PILOT_CTA.primaryActionLabel)).toBe(true);
  });

  it('primary CTA routes to the in-page request form, not a vague marketing page', () => {
    expect(BUYER_PILOT_CTA.primaryActionHref).toMatch(/request-form|pilot|contact/);
  });
});

describe('Buyer-facing language — no fake / over-promising copy', () => {
  it('no buyer copy contains any banned phrase from BANNED_BUYER_PHRASES', () => {
    const text = collectAllBuyerCopy();
    const hit = containsBannedBuyerPhrase(text);
    expect(hit).toBeNull();
  });

  it('containsBannedBuyerPhrase detects banned phrases case-insensitively', () => {
    expect(containsBannedBuyerPhrase('We are TRUSTED BY the top hospitals')).toBe('trusted by');
    expect(containsBannedBuyerPhrase('Everything is Fully Verified')).toBe('fully verified');
    expect(containsBannedBuyerPhrase('A truthful pilot description')).toBeNull();
  });

  it('no buyer copy contains "100% verified" or "all checks passed"', () => {
    const text = collectAllBuyerCopy().toLowerCase();
    expect(text).not.toContain('100% verified');
    expect(text).not.toContain('all checks passed');
  });

  it('no buyer copy fabricates customer names or traction claims', () => {
    const text = collectAllBuyerCopy().toLowerCase();
    // Generic marketing cliches that imply traction we have not earned.
    expect(text).not.toContain('trusted by');
    expect(text).not.toContain('used by leading');
    expect(text).not.toContain('fortune 500');
  });

  it('BANNED_BUYER_PHRASES list is non-empty (the guard is active)', () => {
    expect(BANNED_BUYER_PHRASES.length).toBeGreaterThan(0);
  });
});

describe('Buyer limitations — canonical list stays operational', () => {
  it('BUYER_PILOT_LIMITATIONS names at least one integration scope', () => {
    const joined = BUYER_PILOT_LIMITATIONS.join(' ').toUpperCase();
    expect(joined).toMatch(/NPDB|DEA|ABMS|CAQH|STATE BOARD|PECOS/);
  });

  it('limitation lines never claim completeness', () => {
    for (const line of BUYER_PILOT_LIMITATIONS) {
      const hit = containsBannedBuyerPhrase(line);
      expect(hit).toBeNull();
      expect(line.toLowerCase()).not.toMatch(/fully verified|complete credentialing/);
    }
  });

  it('limitation lines are sentence-length (not single-word platitudes)', () => {
    for (const line of BUYER_PILOT_LIMITATIONS) {
      expect(line.split(/\s+/).length).toBeGreaterThanOrEqual(6);
    }
  });
});

describe('KPI summary copy — honest partial framing', () => {
  it('emptyStateNote does not promise delivered metrics', () => {
    const text = BUYER_PILOT_KPI_COPY.emptyStateNote.toLowerCase();
    expect(text).not.toMatch(/verified|complete|ready to present/);
    expect(text).toMatch(/(not|no|yet)/);
  });

  it('partialStateNote flags missing metrics as honest-partial, not an error', () => {
    const text = BUYER_PILOT_KPI_COPY.partialStateNote.toLowerCase();
    expect(text).toContain('partial');
    // Accepts copy that explicitly negates the "error" framing
    // ("this is not an error"); rejects copy that labels the state
    // itself as an error ("an error occurred", "error state", etc.).
    expect(text).not.toMatch(/(is an error|error state|error occurred|encountered an error)/);
  });

  it('sectionDescription explicitly states metrics degrade rather than impute', () => {
    const text = BUYER_PILOT_KPI_COPY.sectionDescription.toLowerCase();
    expect(text).toMatch(/(degrade|missing|not impute|"—")/);
  });

  it('every tile has a non-empty readsFrom attribution', () => {
    for (const meta of Object.values(BUYER_PILOT_KPI_COPY.tileMeta)) {
      expect(meta.readsFrom.trim().length).toBeGreaterThan(0);
      expect(meta.label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('ALLOWED_CTA_VERBS — commercial clarity', () => {
  it('rejects vague marketing verbs as CTA labels', () => {
    expect(isAllowedCtaVerb('Get started')).toBe(false);
    expect(isAllowedCtaVerb('Try it now')).toBe(false);
    expect(isAllowedCtaVerb('Learn more')).toBe(false);
  });

  it('accepts pilot-specific verbs', () => {
    expect(ALLOWED_CTA_VERBS.every((v) => v.toLowerCase().includes('pilot'))).toBe(true);
  });
});
