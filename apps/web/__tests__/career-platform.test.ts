/**
 * Wave 1000 — Career Platform integration (C6)
 * ──────────────────────────────────────────────────────────────────────────
 * Validates the canonical chain through ONE Career Model:
 *   Education → Evidence → Trust → Recognition → Organizations → Growth →
 *   Opportunities → Legacy.
 * Plus the platform invariants: one source of truth (the ecosystem route and the
 * Career Model agree), deterministic content hash (C4 caching), and the
 * decision-grade honesty contract carried straight through.
 */
import { describe, expect, it } from 'vitest';
import { buildDemoPassport } from '../lib/demo/demo-passport';
import { passportToEvidenceCollection } from '../lib/evidence/passport-to-evidence';
import {
  composeCareerModel,
  projectEvidenceToGraph,
  propagateTrust,
  projectTimeline,
  deriveMobilityOverview,
  projectOrganizations,
  generateIntelligence,
  CAREER_MODEL_SCHEMA,
} from '@vitalcv/domain-evidence';

function model() {
  return composeCareerModel(passportToEvidenceCollection(buildDemoPassport()));
}

describe('Career Platform — canonical model (C1/C6)', () => {
  it('composes one model spanning the full career chain', () => {
    const m = model();
    expect(m.schema).toBe(CAREER_MODEL_SCHEMA);

    // Education → Evidence: training records become evidence objects.
    expect(m.evidence.objects.length).toBeGreaterThan(0);
    // Evidence → Trust: a bounded overall score is derived.
    expect(m.trust.overall.decisionGradeEvidence).toBeGreaterThan(0);
    // Trust → Recognition: timeline reputation summary exists.
    expect(m.timeline.reputation).toBeDefined();
    // Organizations: org graph projected.
    expect(m.organizations).toHaveProperty('organizations');
    // Growth: progression + milestones.
    expect(m.growth.progression).toBeDefined();
    // Opportunities: readiness projected against a template.
    expect(['ready', 'near_ready', 'blocked', 'unknown']).toContain(m.readiness.readiness);
    // Legacy: longitudinal record with eras.
    expect(m.longitudinal.eras.length).toBeGreaterThan(0);
  });

  it('is the single source of truth — model sections equal direct projections', () => {
    const collection = passportToEvidenceCollection(buildDemoPassport());
    const m = composeCareerModel(collection);

    const graph = projectEvidenceToGraph(collection);
    const trust = propagateTrust(graph);
    const timeline = projectTimeline(collection, graph, trust);
    const mobility = deriveMobilityOverview(collection, trust);
    const organizations = projectOrganizations(collection, graph);
    const intelligence = generateIntelligence(collection, trust, timeline, mobility, organizations);

    // No competing source of truth: the aggregate equals the underlying projections.
    expect(m.trust.overall).toEqual(trust.overall);
    expect(m.timeline.events.length).toBe(timeline.events.length);
    expect(m.organizations.organizations.length).toBe(organizations.organizations.length);
    expect(m.intelligence.insights.length).toBe(intelligence.insights.length);
  });

  it('content hash is deterministic and decision-grade honest (C4)', () => {
    const a = model();
    const b = model();
    // Same evidence ⇒ same hash (safe to reuse a cached render).
    expect(a.meta.contentHash).toBe(b.meta.contentHash);
    expect(a.meta.contentHash).toMatch(/^[0-9a-f]{8}$/);

    // Honesty carried through: decisionGrade ⇔ checked, never inflated.
    for (const obj of a.evidence.objects) {
      expect(obj.decisionGrade).toBe(obj.status === 'checked');
    }
    // The model's decision-grade count never exceeds total evidence.
    expect(a.meta.decisionGradeEvidence).toBeLessThanOrEqual(a.meta.totalEvidence);
  });

  it('longitudinal model: legacy is the earliest dated era, milestones immutable-by-derivation', () => {
    const m = model();
    const { longitudinal } = m;

    if (longitudinal.legacy) {
      expect(longitudinal.legacy.startYear).not.toBeNull();
      // Legacy era is the oldest dated era.
      const datedStarts = longitudinal.eras
        .filter((e) => e.startYear !== null)
        .map((e) => e.startYear as number);
      expect(longitudinal.legacy.startYear).toBe(Math.min(...datedStarts));
    }

    // Milestones come straight from growth — same set, no fabrication.
    expect(longitudinal.milestones).toEqual(m.growth.milestones);
    // Re-deriving yields an identical record (immutable/deterministic).
    expect(composeCareerModel(passportToEvidenceCollection(buildDemoPassport())).longitudinal).toEqual(longitudinal);
  });
});
