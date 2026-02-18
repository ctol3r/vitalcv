import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { writeIntegrityFile } from '../storage/integrityWriter';
import type { EvidenceIntegrity } from '../types/psv';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'vitalcv-integrity-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

const integrity: EvidenceIntegrity = {
  rawPayloadHash: 'a'.repeat(64),
  artifactHash: 'b'.repeat(64),
  signatureAlgorithm: 'ES256',
  signature: 'mock-jws-signature',
  publicKeyId: 'key-1',
  signedAt: '2026-02-17T00:00:00.000Z',
};

describe('writeIntegrityFile', () => {
  it('writes integrity.txt with expected fields', async () => {
    const filePath = await writeIntegrityFile(tmpDir, integrity);

    expect(filePath).toBe(path.join(tmpDir, 'integrity.txt'));

    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain(`rawPayloadHash=${'a'.repeat(64)}`);
    expect(content).toContain(`artifactHash=${'b'.repeat(64)}`);
    expect(content).toContain('signatureAlgorithm=ES256');
    expect(content).toContain('signedAt=2026-02-17T00:00:00.000Z');
  });

  it('produces exactly 4 lines plus trailing newline', async () => {
    await writeIntegrityFile(tmpDir, integrity);
    const content = await readFile(path.join(tmpDir, 'integrity.txt'), 'utf-8');
    const lines = content.trimEnd().split('\n');
    expect(lines).toHaveLength(4);
  });
});
