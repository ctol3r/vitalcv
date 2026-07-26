/**
 * Wave 1400 — Operations Platform integration (C6)
 * ──────────────────────────────────────────────────────────────────────────
 * Chain: Evidence → Reasoning → Operations → Organizations → Users → Audit.
 * Asserts the load-bearing rule: operational tasks are DERIVED from real facts
 * (non-decision-grade / revoked / expired evidence, readiness blockers); they
 * are never fabricated, never mutate evidence, never confer decision-grade. The
 * operational event log is explicitly NOT the authoritative audit trail.
 */
import { describe, expect, it } from 'vitest';
import { buildDemoPassport } from '../lib/demo/demo-passport';
import { passportToEvidenceCollection } from '../lib/evidence/passport-to-evidence';
import { composeCareerModel, buildKnowledgeGraph, reason } from '@vitalcv/domain-evidence';
import { deriveTasks, calculateTaskPriority } from '../lib/operations/tasks';
import { recordOperationalEvents } from '../lib/operations/events';
import { projectWorklist, buildActivityFeed } from '../lib/operations/projections';

function model() {
  return composeCareerModel(passportToEvidenceCollection(buildDemoPassport()));
}

const AT = '2026-06-20T00:00:00.000Z';

describe('Operations Platform (C2/C3/C6)', () => {
  it('derives tasks only from real, non-decision-grade evidence (no fabrication)', () => {
    const m = model();
    const tasks = deriveTasks(m);

    // Every verify task points at a real, active, non-decision-grade evidence item.
    for (const t of tasks) {
      if (t.type === 'verify_evidence') {
        const obj = m.evidence.objects.find((o) => o.evidenceId === t.evidenceId);
        expect(obj).toBeDefined();
        expect(obj!.decisionGrade).toBe(false);
        expect(obj!.lifecycle).toBe('active');
      }
    }
    // A subject with at least one non-decision-grade item (demo: self-reported ABMS)
    // produces at least one verify task; a fully-checked subject would produce none.
    const nonDg = m.evidence.objects.filter((o) => o.lifecycle === 'active' && !o.decisionGrade);
    expect(tasks.filter((t) => t.type === 'verify_evidence')).toHaveLength(nonDg.length);
  });

  it('priority reflects real risk, never arbitrary', () => {
    expect(calculateTaskPriority({ blocking: true, expired: false, fixableGap: false })).toBe('critical');
    expect(calculateTaskPriority({ blocking: false, expired: true, fixableGap: false })).toBe('high');
    expect(calculateTaskPriority({ blocking: false, expired: false, fixableGap: true })).toBe('high');
    expect(calculateTaskPriority({ blocking: false, expired: false, fixableGap: false })).toBe('normal');
  });

  it('operations never mutate the model or confer decision-grade', () => {
    const m = model();
    const beforeDg = m.meta.decisionGradeEvidence;
    const beforeHash = m.meta.contentHash;
    deriveTasks(m);
    expect(m.meta.decisionGradeEvidence).toBe(beforeDg);
    expect(m.meta.contentHash).toBe(beforeHash);
  });

  it('Evidence → Reasoning → Operations chain agrees on decision-grade facts', () => {
    const m = model();
    // Reasoning over the same evidence yields the honest decision-grade count.
    const reasoning = reason(buildKnowledgeGraph(m.evidence), { maxDepth: 3 });
    // Operations' verify-task count never exceeds the non-decision-grade evidence —
    // operations cannot claim more (or less) verified than reality.
    const tasks = deriveTasks(m);
    const verifyTasks = tasks.filter((t) => t.type === 'verify_evidence').length;
    const nonDg = m.evidence.objects.filter((o) => o.lifecycle === 'active' && !o.decisionGrade).length;
    expect(verifyTasks).toBe(nonDg);
    expect(reasoning.explanation.confidence.decisionGradeEvidence).toBe(m.meta.decisionGradeEvidence);
  });
});

describe('Operations — worklist, activity & audit posture (C4/C5)', () => {
  it('worklist groups by role and orders by honest priority', () => {
    const m = model();
    const tasks = deriveTasks(m);
    const worklist = projectWorklist(m.identity.subjectKey, tasks);

    expect(worklist.total).toBe(tasks.length);
    // ordered is priority-sorted: no lower-priority task precedes a higher one.
    const rank = { critical: 0, high: 1, normal: 2, low: 3 } as const;
    for (let i = 1; i < worklist.ordered.length; i++) {
      expect(rank[worklist.ordered[i - 1].priority]).toBeLessThanOrEqual(rank[worklist.ordered[i].priority]);
    }
    // Every task lands in exactly one role bucket.
    const bucketed = worklist.byRole.credentialer.length + worklist.byRole.recruiter.length + worklist.byRole.clinician.length;
    expect(bucketed).toBe(tasks.length);
  });

  it('operational events are NOT the authoritative audit and carry no PHI', () => {
    const m = model();
    const events = recordOperationalEvents(deriveTasks(m), AT);
    for (const e of events) {
      expect(e.authoritative).toBe(false); // never claims to be the issuer/PSV audit
      expect(e.subjectKey).toBe(m.identity.subjectKey);
      // No provider display name leaks into the operational log.
      expect(JSON.stringify(e)).not.toContain(m.identity.displayName);
    }
    const feed = buildActivityFeed(events);
    expect(feed.every((a) => a.authoritative === false)).toBe(true);
  });

  it('is deterministic for a given worklist + timestamp', () => {
    const m = model();
    const a = recordOperationalEvents(deriveTasks(m), AT);
    const b = recordOperationalEvents(deriveTasks(m), AT);
    expect(a).toEqual(b);
  });
});
