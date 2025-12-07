import {
  FPPECaseStatusSchema,
  applyChecklistUpdates,
  calculateFPPEDueDate,
  canTransitionFPPECaseStatus,
  normalizeChecklist,
  serializeFPPECase,
} from '../FPPECase';

describe('FPPECase model', () => {
  it('calculates due date 30 days after start', () => {
    const start = new Date('2025-01-05T00:00:00Z');
    const due = calculateFPPEDueDate(start);
    expect(due.toISOString()).toBe('2025-02-04T00:00:00.000Z');
  });

  it('enforces valid status transitions', () => {
    expect(canTransitionFPPECaseStatus('OPEN', 'IN_REVIEW').allowed).toBe(true);
    expect(canTransitionFPPECaseStatus('IN_REVIEW', 'COMPLETED').allowed).toBe(true);
    const invalid = canTransitionFPPECaseStatus('COMPLETED', 'OPEN');
    expect(invalid.allowed).toBe(false);
    expect(invalid.reason).toMatch(/Cannot transition/);
  });

  it('applies checklist updates and auto-progresses status', () => {
    const checklist = normalizeChecklist({
      version: 1,
      privilegeCode: 'CARD-CATH-ADULT',
      items: [
        {
          key: 'chartsReviewed',
          label: 'Charts reviewed',
          required: true,
          targetCount: 10,
          completedCount: 0,
          status: 'PENDING',
          evidence: [],
        },
      ],
    });

    const updated = applyChecklistUpdates(checklist, [
      {
        key: 'chartsReviewed',
        completedCount: 10,
      },
    ]);

    expect(updated.items[0].completedCount).toBe(10);
    expect(updated.items[0].status).toBe('COMPLETE');
  });

  it('serializes case records with ISO timestamps', () => {
    const now = new Date('2025-03-01T10:00:00Z');
    const serialized = serializeFPPECase({
      id: 'case-1',
      clinicianId: 'did:example:123',
      orgId: 'org-1',
      privilegeGrantedId: 'pg-1',
      privilegeCode: 'CARD-PCI',
      startAt: now,
      dueAt: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      status: 'OPEN',
      evaluatorId: null,
      checklist: {
        version: 1,
        privilegeCode: 'CARD-PCI',
        items: [],
      },
      notes: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    expect(serialized.id).toBe('case-1');
    expect(serialized.status).toBe('OPEN');
    expect(FPPECaseStatusSchema.safeParse(serialized.status).success).toBe(true);
    expect(serialized.startAt).toBe('2025-03-01T10:00:00.000Z');
    expect(serialized.isOverdue).toBe(false);
  });
});
import {
  CreateFPPECaseSchema,
  FPPECaseStatus,
  canTransitionFPPECaseStatus,
  calculateFPPEDueDate,
  isFPPECaseOverdue,
  serializeFPPECase,
} from '../FPPECase';

describe('FPPECase model', () => {
  it('applies defaults when creating a case', () => {
    const start = new Date('2025-01-01T00:00:00Z');
    const due = calculateFPPEDueDate(start);
    const payload = {
      clinicianId: 'did:example:123',
      orgId: 'org-demo',
      privilegeGrantedId: 'grant-1',
      privilegeCode: 'GENERAL_SURGERY',
      startAt: start,
      dueAt: due,
    };

    const result = CreateFPPECaseSchema.parse(payload);
    expect(result.status).toBe(FPPECaseStatus.OPEN);
    expect(result.clinicianId).toBe(payload.clinicianId);
    expect(result.dueAt.toISOString()).toBe(due.toISOString());
  });

  it('calculates 30 day default due dates', () => {
    const start = new Date('2025-02-01T12:00:00Z');
    const due = calculateFPPEDueDate(start);
    const diffDays = Math.round((due.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(30);
  });

  it('enforces valid status transitions', () => {
    expect(canTransitionFPPECaseStatus(FPPECaseStatus.OPEN, FPPECaseStatus.IN_REVIEW).allowed).toBe(true);
    const invalid = canTransitionFPPECaseStatus(FPPECaseStatus.COMPLETED, FPPECaseStatus.OPEN);
    expect(invalid.allowed).toBe(false);
    expect(invalid.reason).toMatch(/Cannot transition/);
  });

  it('detects overdue cases only for active statuses', () => {
    const now = new Date('2025-03-01T00:00:00Z');
    const overdue = isFPPECaseOverdue(
      { dueAt: new Date('2025-02-15T00:00:00Z'), status: FPPECaseStatus.OPEN },
      now
    );
    expect(overdue).toBe(true);

    const completed = isFPPECaseOverdue(
      { dueAt: new Date('2025-02-01T00:00:00Z'), status: FPPECaseStatus.COMPLETED },
      now
    );
    expect(completed).toBe(false);
  });

  it('serializes case record with ISO timestamps', () => {
    const record = {
      id: 'case-1',
      clinicianId: 'did:example:999',
      orgId: 'org-1',
      privilegeGrantedId: 'grant-1',
      privilegeCode: 'CARDIOLOGY',
      startAt: new Date('2025-01-01T00:00:00Z'),
      dueAt: new Date(Date.now() - 86_400_000), // yesterday
      status: FPPECaseStatus.OPEN,
      evaluatorId: null,
      checklist: null,
      notes: null,
      completedAt: null,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-01T00:00:00Z'),
    };

    const serialized = serializeFPPECase(record);
    expect(serialized.id).toBe(record.id);
    expect(serialized.startAt).toBe(record.startAt.toISOString());
    expect(serialized.overdue).toBe(true);
  });
});

