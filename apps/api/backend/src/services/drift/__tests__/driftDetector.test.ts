jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    verificationArtifact: { findFirst: jest.fn() },
    driftEvent: { create: jest.fn() },
  },
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import { detectAndRecordDrift } from '../driftDetector';

const prismaMock = prisma as unknown as {
  verificationArtifact: { findFirst: jest.Mock };
  driftEvent: { create: jest.Mock };
};

describe('detectAndRecordDrift', () => {
  beforeEach(() => {
    prismaMock.verificationArtifact.findFirst.mockReset();
    prismaMock.driftEvent.create.mockReset();
    prismaMock.driftEvent.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: `drift-${data.driftType}` }),
    );
  });

  it('records a first_observation event when there is no prior artifact', async () => {
    prismaMock.verificationArtifact.findFirst.mockResolvedValue(null);
    const result = await detectAndRecordDrift({
      subjectNpi: '1234567890',
      source: 'NPPES',
      newValue: { active: true },
    });
    expect(result.drifted).toBe(true);
    expect(result.driftType).toBe('first_observation');
    expect(prismaMock.driftEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subjectNpi: '1234567890',
          source: 'NPPES',
          driftType: 'first_observation',
        }),
      }),
    );
  });

  it('returns no drift when the canonicalized value is identical', async () => {
    prismaMock.verificationArtifact.findFirst.mockResolvedValue({
      // Same fields, different key order — canonicalization should match.
      rawPayload: { b: 2, a: 1 },
    });
    const result = await detectAndRecordDrift({
      subjectNpi: '1234567890',
      source: 'NPPES',
      newValue: { a: 1, b: 2 },
    });
    expect(result.drifted).toBe(false);
    expect(prismaMock.driftEvent.create).not.toHaveBeenCalled();
  });

  it('records a value_changed event when the value differs', async () => {
    prismaMock.verificationArtifact.findFirst.mockResolvedValue({
      rawPayload: { active: true },
    });
    const result = await detectAndRecordDrift({
      subjectNpi: '1234567890',
      source: 'NPPES',
      newValue: { active: false },
    });
    expect(result.drifted).toBe(true);
    expect(result.driftType).toBe('value_changed');
    expect(prismaMock.driftEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          driftType: 'value_changed',
          previousValue: { active: true },
          newValue: { active: false },
        }),
      }),
    );
  });

  it('honors the caller-provided previousValue and skips the prisma read', async () => {
    const result = await detectAndRecordDrift({
      subjectNpi: '1234567890',
      source: 'OIG',
      previousValue: { excluded: false },
      newValue: { excluded: true },
      driftType: 'status_flipped',
    });
    expect(prismaMock.verificationArtifact.findFirst).not.toHaveBeenCalled();
    expect(result.driftType).toBe('status_flipped');
  });

  it('returns no drift on missing inputs', async () => {
    expect(
      await detectAndRecordDrift({ subjectNpi: '', source: 'NPPES', newValue: {} }),
    ).toEqual({ drifted: false, driftType: null, eventId: null });
    expect(
      await detectAndRecordDrift({ subjectNpi: '1234567890', source: '', newValue: {} }),
    ).toEqual({ drifted: false, driftType: null, eventId: null });
    expect(prismaMock.driftEvent.create).not.toHaveBeenCalled();
  });

  it('swallows persistence errors and returns no drift', async () => {
    prismaMock.verificationArtifact.findFirst.mockResolvedValue({ rawPayload: { active: true } });
    prismaMock.driftEvent.create.mockRejectedValue(new Error('db down'));
    const result = await detectAndRecordDrift({
      subjectNpi: '1234567890',
      source: 'NPPES',
      newValue: { active: false },
    });
    expect(result.drifted).toBe(false);
  });
});
