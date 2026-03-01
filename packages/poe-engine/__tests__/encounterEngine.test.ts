import { describe, it, expect } from 'vitest';
import { generateEncounterRoot, type EncounterRecord } from '../encounterEngine';
import { verifyEncounterRoot } from '../encounterVerifier';

const sampleEncounters: EncounterRecord[] = [
  { date: '2025-01-15', cptCode: '27447', riskOutcome: 'low' },
  { date: '2025-02-20', cptCode: '27447', riskOutcome: 'moderate' },
  { date: '2025-03-10', cptCode: '27447', riskOutcome: 'low', facilityHash: 'abc123def456' },
];

describe('generateEncounterRoot', () => {
  it('produces a 64-char hex merkle root', () => {
    const result = generateEncounterRoot(sampleEncounters);
    expect(result.merkleRoot).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns correct volume count', () => {
    const result = generateEncounterRoot(sampleEncounters);
    expect(result.volumeCount).toBe(3);
  });

  it('returns leaf hashes as 64-char hex strings', () => {
    const result = generateEncounterRoot(sampleEncounters);
    expect(result.leafHashes).toHaveLength(3);
    for (const hash of result.leafHashes) {
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('is deterministic — same input produces same root', () => {
    const a = generateEncounterRoot(sampleEncounters);
    const b = generateEncounterRoot(sampleEncounters);
    expect(a.merkleRoot).toBe(b.merkleRoot);
    expect(a.leafHashes).toEqual(b.leafHashes);
  });

  it('different encounters produce different roots', () => {
    const altered: EncounterRecord[] = [
      { date: '2025-01-15', cptCode: '27447', riskOutcome: 'high' },
      { date: '2025-02-20', cptCode: '27447', riskOutcome: 'moderate' },
      { date: '2025-03-10', cptCode: '27447', riskOutcome: 'low', facilityHash: 'abc123def456' },
    ];
    const original = generateEncounterRoot(sampleEncounters);
    const changed = generateEncounterRoot(altered);
    expect(original.merkleRoot).not.toBe(changed.merkleRoot);
  });

  it('throws on empty array', () => {
    expect(() => generateEncounterRoot([])).toThrow('non-empty');
  });

  it('throws on missing cptCode', () => {
    expect(() =>
      generateEncounterRoot([{ date: '2025-01-01', cptCode: '', riskOutcome: 'low' }]),
    ).toThrow('cptCode');
  });

  it('throws on missing date', () => {
    expect(() =>
      generateEncounterRoot([{ date: '', cptCode: '27447', riskOutcome: 'low' }]),
    ).toThrow('date');
  });

  it('throws on missing riskOutcome', () => {
    expect(() =>
      generateEncounterRoot([{ date: '2025-01-01', cptCode: '27447', riskOutcome: '' }]),
    ).toThrow('riskOutcome');
  });

  it('handles single encounter', () => {
    const result = generateEncounterRoot([sampleEncounters[0]]);
    expect(result.merkleRoot).toMatch(/^[0-9a-f]{64}$/);
    expect(result.volumeCount).toBe(1);
    expect(result.leafHashes).toHaveLength(1);
  });
});

describe('verifyEncounterRoot', () => {
  it('round-trips through generate → verify', () => {
    const result = generateEncounterRoot(sampleEncounters);
    const verification = verifyEncounterRoot(result.leafHashes, result.merkleRoot);
    expect(verification.valid).toBe(true);
    expect(verification.volumeCount).toBe(3);
    expect(verification.actualRoot).toBe(verification.expectedRoot);
  });

  it('rejects tampered root', () => {
    const result = generateEncounterRoot(sampleEncounters);
    const verification = verifyEncounterRoot(result.leafHashes, 'deadbeef'.repeat(8));
    expect(verification.valid).toBe(false);
  });

  it('rejects empty leaf hashes', () => {
    const verification = verifyEncounterRoot([], 'deadbeef'.repeat(8));
    expect(verification.valid).toBe(false);
    expect(verification.volumeCount).toBe(0);
  });

  it('rejects tampered leaf hash', () => {
    const result = generateEncounterRoot(sampleEncounters);
    const tamperedLeaves = [...result.leafHashes];
    tamperedLeaves[0] = 'a'.repeat(64);
    const verification = verifyEncounterRoot(tamperedLeaves, result.merkleRoot);
    expect(verification.valid).toBe(false);
  });
});
