import { PrismaClient, NPDBQueryStatus } from '@prisma/client';
import {
  createNPDBQuery,
  deleteNPDBQuery,
  getNPDBQueryById,
  latestNPDBQueryForClinician,
  listNPDBQueries,
  resetNPDBQueryToPending,
  updateNPDBQuery,
} from '../NPDBQuery';

const prisma = new PrismaClient();

describe('NPDBQuery model', () => {
  const clinicianId = `clinician-${Date.now()}`;
  const baseNpi = '1234567890';
  const baseXml = '<NPDBRequest><Subject>Alice</Subject></NPDBRequest>';
  let primaryQueryId: string;

  afterAll(async () => {
    await prisma.nPDBQuery.deleteMany({ where: { clinicianId } });
    await prisma.$disconnect();
  });

  it('creates a query with normalized fields and default status', async () => {
    const record = await createNPDBQuery({
      clinicianId,
      npi: baseNpi,
      state: 'ca',
      requestXml: `  ${baseXml}  `,
    });

    primaryQueryId = record.id;

    expect(record.status).toBe(NPDBQueryStatus.PENDING);
    expect(record.requestXml).toBe(baseXml);
    expect(record.responseXml).toBeNull();

    const fetched = await getNPDBQueryById(record.id);
    expect(fetched?.clinicianId).toBe(clinicianId);
  });

  it('updates status, response XML, and summary with valid transitions', async () => {
    const sent = await updateNPDBQuery(primaryQueryId, {
      status: NPDBQueryStatus.SENT,
    });
    expect(sent.status).toBe(NPDBQueryStatus.SENT);
    expect(sent.sentAt).toBeInstanceOf(Date);

    const completed = await updateNPDBQuery(primaryQueryId, {
      status: NPDBQueryStatus.COMPLETED,
      responseXml: '<NPDBResponse status="OK"/>',
      resultSummary: {
        hasReport: false,
        reportCount: 0,
      },
    });

    expect(completed.status).toBe(NPDBQueryStatus.COMPLETED);
    expect(completed.responseXml).toContain('NPDBResponse');
    expect(completed.completedAt).toBeInstanceOf(Date);
    expect(completed.resultSummary).toEqual({
      hasReport: false,
      reportCount: 0,
    });
  });

  it('lists queries with filters and returns latest entry', async () => {
    await createNPDBQuery({
      clinicianId,
      npi: '2234567890',
      state: 'ny',
      requestXml: '<NPDBRequest><Subject>Bob</Subject></NPDBRequest>',
      status: NPDBQueryStatus.PENDING,
    });

    const listByClinician = await listNPDBQueries({ clinicianId });
    expect(listByClinician.length).toBeGreaterThanOrEqual(2);

    const listByStatus = await listNPDBQueries({
      clinicianId,
      status: NPDBQueryStatus.PENDING,
    });
    expect(listByStatus.every(q => q.status === NPDBQueryStatus.PENDING)).toBe(true);

    const latest = await latestNPDBQueryForClinician(clinicianId);
    expect(latest).not.toBeNull();
    expect(latest?.clinicianId).toBe(clinicianId);
  });

  it('prevents invalid status transitions and allows reset before completion', async () => {
    const pendingQuery = await createNPDBQuery({
      clinicianId,
      npi: '3234567890',
      state: 'wa',
      requestXml: '<NPDBRequest><Subject>Carol</Subject></NPDBRequest>',
    });

    await updateNPDBQuery(pendingQuery.id, {
      status: NPDBQueryStatus.SENT,
    });

    const reset = await resetNPDBQueryToPending(pendingQuery.id);
    expect(reset.status).toBe(NPDBQueryStatus.PENDING);
    expect(reset.responseXml).toBeNull();

    await updateNPDBQuery(pendingQuery.id, {
      status: NPDBQueryStatus.COMPLETED,
      responseXml: '<NPDBResponse><Summary>Done</Summary></NPDBResponse>',
    });

    await expect(
      updateNPDBQuery(pendingQuery.id, { status: NPDBQueryStatus.SENT })
    ).rejects.toThrow('Invalid NPDB query status transition');

    await expect(resetNPDBQueryToPending(pendingQuery.id)).rejects.toThrow(
      'Completed or failed NPDB queries cannot be reset'
    );
  });

  it('deletes a query record', async () => {
    const doomed = await createNPDBQuery({
      clinicianId,
      npi: '4234567890',
      state: 'tx',
      requestXml: '<NPDBRequest><Subject>Dave</Subject></NPDBRequest>',
    });

    const deleted = await deleteNPDBQuery(doomed.id);
    expect(deleted.id).toBe(doomed.id);

    const shouldBeNull = await getNPDBQueryById(doomed.id);
    expect(shouldBeNull).toBeNull();
  });
});

