import express from 'express';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/graphql/prisma_client';
import { registerWave2AVerifyRoutes } from '../src/modules/wave2a';
import { getVerificationSource, SourceAccessRequiredError } from '../src/services/sourceRegistry';
import { NursysStubAdapter } from '../src/services/adapters/nursysStubAdapter';
import { isDecisionGradeArtifact } from '../src/services/artifactDecisionGrade';
import { createArtifactFromNursys } from '../src/services/artifactService';

/**
 * Truth contract: the deterministic Nursys stub fabricates license statuses
 * from NPI digits. Production must fail closed — no seam may persist or
 * present fabricated verification results. Dev/test keep the stub as the
 * pipeline stand-in.
 */

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function asProduction(): void {
  process.env.NODE_ENV = 'production';
}

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
});

describe('verification source registry fail-closed policy', () => {
  it('declares the Nursys stub non-decision-grade', () => {
    const adapter = new NursysStubAdapter();
    expect(adapter.decisionGrade).toBe(false);
  });

  it('serves the stub outside production (pipeline stand-in unchanged)', () => {
    const source = getVerificationSource('NURSYS');
    expect(source.name).toBe('NURSYS_STUB');
    expect(source.decisionGrade).toBe(false);
  });

  it('refuses the fabricating stub in production', () => {
    asProduction();
    expect(() => getVerificationSource('NURSYS')).toThrow(SourceAccessRequiredError);
    try {
      getVerificationSource('NURSYS');
      throw new Error('expected SourceAccessRequiredError');
    } catch (error) {
      expect(error).toBeInstanceOf(SourceAccessRequiredError);
      expect((error as SourceAccessRequiredError).code).toBe('SOURCE_ACCESS_REQUIRED');
      expect((error as SourceAccessRequiredError).sourceName).toBe('NURSYS');
    }
  });

  it('refuses a direct NURSYS_STUB request in production', () => {
    asProduction();
    expect(() => getVerificationSource('NURSYS_STUB')).toThrow(SourceAccessRequiredError);
  });

  it('still refuses REAL_NURSYS_ENABLED=true until a live adapter exists', () => {
    const original = process.env.REAL_NURSYS_ENABLED;
    process.env.REAL_NURSYS_ENABLED = 'true';
    try {
      expect(() => getVerificationSource('NURSYS')).toThrow(
        /Real Nursys adapter not implemented/,
      );
    } finally {
      if (original === undefined) {
        delete process.env.REAL_NURSYS_ENABLED;
      } else {
        process.env.REAL_NURSYS_ENABLED = original;
      }
    }
  });
});

describe('isDecisionGradeArtifact', () => {
  it('marks stub-stamped NURSYS artifacts non-decision-grade', () => {
    expect(
      isDecisionGradeArtifact({
        source: 'NURSYS',
        rawPayload: { adapterName: 'NURSYS_STUB', licenseStatus: 'ACTIVE' },
      }),
    ).toBe(false);
  });

  it('marks legacy NURSYS artifacts without an adapter stamp non-decision-grade', () => {
    expect(isDecisionGradeArtifact({ source: 'NURSYS', rawPayload: { npi: '1234567890' } })).toBe(
      false,
    );
    expect(isDecisionGradeArtifact({ source: 'NURSYS', rawPayload: null })).toBe(false);
    expect(isDecisionGradeArtifact({ source: 'NURSYS_STUB', rawPayload: {} })).toBe(false);
  });

  it('accepts NURSYS artifacts stamped by a real (future) adapter', () => {
    expect(
      isDecisionGradeArtifact({
        source: 'NURSYS',
        rawPayload: { adapterName: 'NURSYS_ENOTIFY' },
      }),
    ).toBe(true);
  });

  it('leaves non-NURSYS sources untouched', () => {
    expect(isDecisionGradeArtifact({ source: 'NPPES_API', rawPayload: null })).toBe(true);
    expect(isDecisionGradeArtifact({ source: 'OIG_LEIE', rawPayload: {} })).toBe(true);
  });
});

describe('createArtifactFromNursys in production', () => {
  it('rejects with SourceAccessRequiredError before touching the database', async () => {
    asProduction();
    await expect(createArtifactFromNursys('1234567890')).rejects.toBeInstanceOf(
      SourceAccessRequiredError,
    );
  });
});

describe('POST /api/v2/verify (wave2a) in production', () => {
  // registerWave2AVerifyRoutes currently has no caller in src/app.ts (the
  // module is unmounted), so exercise the handler on a scratch app.
  const wave2aApp = express();
  wave2aApp.use(express.json());
  registerWave2AVerifyRoutes(wave2aApp);

  it('returns an honest 503 source_access_required instead of persisting fabricated data', async () => {
    asProduction();
    const res = await request(wave2aApp).post('/api/v2/verify').send({ npi: '1234567890' });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('source_access_required');
    expect(res.body.message).toContain('requires primary-source access');
  });
});

// DB-backed assertions — run only under the ephemeral-Postgres test harness.
const runDbSuite = process.env.DATABASE_URL ? describe : describe.skip;

runDbSuite('share-link verify fail-closed (DB-backed)', () => {
  const TEST_NPI = '1998887776';

  beforeEach(async () => {
    await prisma.auditEvent.deleteMany();
    await prisma.shareLink.deleteMany();
    await prisma.verificationArtifact.deleteMany({ where: { npi: TEST_NPI } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns an honest SOURCE_ACCESS_REQUIRED state in production and persists nothing', async () => {
    const link = await prisma.shareLink.create({ data: { npi: TEST_NPI } });

    asProduction();
    const res = await request(app).get(`/api/verify/${link.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'SOURCE_ACCESS_REQUIRED',
      trustState: 'needs_review',
      decisionGrade: false,
      checksum: null,
      crossCheckEligible: false,
    });
    expect(res.body.reason).toContain('primary-source access');

    const persisted = await prisma.verificationArtifact.findFirst({ where: { npi: TEST_NPI } });
    expect(persisted).toBeNull();
  });

  it('treats an existing fabricated artifact as absent in production', async () => {
    const link = await prisma.shareLink.create({ data: { npi: TEST_NPI } });
    await prisma.verificationArtifact.create({
      data: {
        npi: TEST_NPI,
        source: 'NURSYS',
        status: 'ACTIVE',
        rawPayload: { adapterName: 'NURSYS_STUB', licenseStatus: 'ACTIVE' },
        checksum: 'stub-checksum',
        verifiedAt: new Date(),
      },
    });

    asProduction();
    const res = await request(app).get(`/api/verify/${link.id}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SOURCE_ACCESS_REQUIRED');
    expect(res.body.decisionGrade).toBe(false);
    expect(res.body.status).not.toBe('VERIFIED');
  });

  it('keeps the lazy stub path working outside production, now with an explicit non-decision-grade marker', async () => {
    const link = await prisma.shareLink.create({ data: { npi: TEST_NPI } });

    const res = await request(app).get(`/api/verify/${link.id}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('VERIFIED');
    expect(res.body.decisionGrade).toBe(false);
  });
});
