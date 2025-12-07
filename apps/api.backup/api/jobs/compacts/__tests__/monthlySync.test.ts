import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import yaml from 'js-yaml';
import { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { runMonthlyCompactSync } from '../monthlySync.js';

const prisma = new PrismaClient();

describe('monthly compact sync job', () => {
  let tempDir: string;
  let configPath: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'compact-sync-'));
    configPath = path.join(tempDir, 'matrix.yaml');
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.compactMatrix.deleteMany({});
  });

  afterEach(async () => {
    await prisma.compactMatrix.deleteMany({});
  });

  it('activates new states and logs changes', async () => {
    await prisma.compactMatrix.create({
      data: {
        compact: 'IMLC',
        state: 'TX',
        status: 'inactive',
      },
    });

    await writeConfig({
      version: 'test-1',
      compacts: {
        IMLC: {
          participating_states: ['TX', 'CA'],
          special_rules: { residency_days: 30 },
        },
      },
    });

    const summary = await runMonthlyCompactSync({ configPath, prisma });

    expect(summary.configVersion).toBe('test-1');
    expect(summary.changeCount).toBe(2);
    expect(summary.statsByCompact.IMLC.added).toBe(1);
    expect(summary.statsByCompact.IMLC.reactivated).toBe(1);

    const records = await prisma.compactMatrix.findMany({ where: { compact: 'IMLC' }, orderBy: { state: 'asc' } });
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.state)).toEqual(['CA', 'TX']);
    expect(records.every((r) => r.status === 'active')).toBe(true);
    expect(records.find((r) => r.state === 'CA')?.specialRules).toEqual({ residency_days: 30 });
  });

  it('marks removed states as inactive', async () => {
    await prisma.compactMatrix.create({
      data: {
        compact: 'PSYPACT',
        state: 'WA',
        status: 'active',
      },
    });

    await writeConfig({
      version: 'test-2',
      compacts: {
        PSYPACT: {
          participating_states: [],
        },
      },
    });

    const summary = await runMonthlyCompactSync({ configPath, prisma });

    expect(summary.statsByCompact.PSYPACT?.inactivated ?? 0).toBe(1);
    expect(summary.changeCount).toBe(1);

    const record = await prisma.compactMatrix.findUnique({
      where: {
        compact_state: {
          compact: 'PSYPACT',
          state: 'WA',
        },
      },
    });

    expect(record?.status).toBe('inactive');
  });

  async function writeConfig(data: unknown) {
    await fs.writeFile(configPath, yaml.dump(data), 'utf8');
  }
});
