import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { storeRawPayload, ImmutableBlobError } from '../storage/objectStore';
import { canonicalize } from '../utils/canonicalize';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'vitalcv-store-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('storeRawPayload', () => {
  const artifactId = 'artifact-001';
  const payload = { result_count: 1, results: [{ number: 1234567890 }] };

  it('writes canonicalized payload to {artifactId}/raw.json', async () => {
    const filePath = await storeRawPayload(artifactId, payload, tmpDir);

    expect(filePath).toBe(path.join(tmpDir, artifactId, 'raw.json'));

    const stored = await readFile(filePath, 'utf-8');
    expect(stored).toBe(canonicalize(payload));
  });

  it('throws ImmutableBlobError on second write to same artifact', async () => {
    await storeRawPayload(artifactId, payload, tmpDir);

    await expect(
      storeRawPayload(artifactId, payload, tmpDir),
    ).rejects.toThrow(ImmutableBlobError);
  });

  it('stores different artifacts independently', async () => {
    const path1 = await storeRawPayload('artifact-aaa', payload, tmpDir);
    const path2 = await storeRawPayload('artifact-bbb', payload, tmpDir);

    expect(path1).not.toBe(path2);
    const content1 = await readFile(path1, 'utf-8');
    const content2 = await readFile(path2, 'utf-8');
    expect(content1).toBe(content2); // same payload, same canonical form
  });

  it('produces deterministic output for same payload', async () => {
    const path1 = await storeRawPayload('det-1', { b: 2, a: 1 }, tmpDir);
    const path2 = await storeRawPayload('det-2', { a: 1, b: 2 }, tmpDir);

    const content1 = await readFile(path1, 'utf-8');
    const content2 = await readFile(path2, 'utf-8');
    expect(content1).toBe(content2);
  });
});
