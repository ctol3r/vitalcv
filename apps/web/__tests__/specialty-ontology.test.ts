import { describe, it, expect } from 'vitest';
import {
  CERTIFICATES,
  RESIDENCIES,
  NUCC_CROSSWALK,
  certificatePathTo,
  resolveNuccCode,
} from '@/lib/specialty-ontology';
import { INSTITUTIONS } from '@/lib/institutions/curated';

const certIds = new Set(CERTIFICATES.map((c) => c.id));
const boardIds = new Set(INSTITUTIONS.filter((i) => i.kind === 'board').map((i) => i.id));

describe('specialty certificates', () => {
  it('has globally unique kebab-case ids', () => {
    const ids = CERTIFICATES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it('every issuing board resolves to a curated institution of kind board', () => {
    for (const cert of CERTIFICATES) {
      expect(cert.issuingBoards.length, cert.id).toBeGreaterThan(0);
      for (const b of cert.issuingBoards) {
        expect(boardIds.has(b.boardId), `${cert.id} → unknown board ${b.boardId}`).toBe(true);
      }
    }
  });

  it('co-sponsored certificates carry at most one admin board', () => {
    for (const cert of CERTIFICATES) {
      const admins = cert.issuingBoards.filter((b) => b.admin).length;
      expect(admins, cert.id).toBeLessThanOrEqual(1);
    }
  });

  it('every prerequisite resolves to an existing certificate', () => {
    for (const cert of CERTIFICATES) {
      for (const p of cert.prerequisites ?? []) {
        expect(certIds.has(p), `${cert.id} → unknown prerequisite ${p}`).toBe(true);
      }
    }
  });

  it('the prerequisite graph is acyclic', () => {
    const visiting = new Set<string>();
    const done = new Set<string>();
    const visit = (id: string): void => {
      if (done.has(id)) return;
      expect(visiting.has(id), `cycle through ${id}`).toBe(false);
      visiting.add(id);
      const cert = CERTIFICATES.find((c) => c.id === id);
      for (const p of cert?.prerequisites ?? []) visit(p);
      visiting.delete(id);
      done.add(id);
    };
    for (const cert of CERTIFICATES) visit(cert.id);
  });

  it('matches the published shape of the ABMS taxonomy', () => {
    const primaries = CERTIFICATES.filter((c) => c.level === 'primary');
    const subs = CERTIFICATES.filter((c) => c.level === 'subspecialty');
    expect(primaries.length).toBeGreaterThanOrEqual(36);
    expect(subs.length).toBeGreaterThanOrEqual(80);
    // Second-order chains exist (fellowship-of-a-fellowship):
    expect(certificatePathTo('interventional-cardiology')).toEqual([
      'internal-medicine',
      'cardiovascular-disease',
    ]);
    expect(certificatePathTo('pediatric-transplant-hepatology')).toEqual([
      'pediatrics',
      'pediatric-gastroenterology',
    ]);
  });
});

describe('residency program types', () => {
  it('has unique ids in a distinct id space', () => {
    const ids = RESIDENCIES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^residency-[a-z0-9-]+$/);
  });

  it('leadsTo references existing primary certificates', () => {
    for (const res of RESIDENCIES) {
      for (const certId of res.leadsTo) {
        const cert = CERTIFICATES.find((c) => c.id === certId);
        expect(cert, `${res.id} → unknown certificate ${certId}`).toBeDefined();
        expect(cert?.level, `${res.id} → ${certId} is not primary`).toBe('primary');
      }
    }
  });
});

describe('NUCC crosswalk', () => {
  it('has unique, well-formed 10-character codes', () => {
    const codes = NUCC_CROSSWALK.map((e) => e.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[0-9A-Z]{9}X$/);
  });

  it('every certificate mapping resolves', () => {
    for (const entry of NUCC_CROSSWALK) {
      if (entry.mapping.kind === 'certificate') {
        expect(
          certIds.has(entry.mapping.certificateId),
          `${entry.code} → unknown certificate ${entry.mapping.certificateId}`,
        ).toBe(true);
      }
    }
  });

  it('covers the physician grouping seed and resolves NPPES-shaped lookups', () => {
    expect(NUCC_CROSSWALK.length).toBeGreaterThanOrEqual(230);
    // Internal Medicine base code → primary certificate:
    const im = resolveNuccCode('207R00000X');
    expect(im?.mapping).toEqual({ kind: 'certificate', certificateId: 'internal-medicine' });
    // Cardiovascular Disease specialization → subspecialty certificate:
    const cards = resolveNuccCode('207RC0000X');
    expect(cards?.mapping).toEqual({ kind: 'certificate', certificateId: 'cardiovascular-disease' });
    // Hospitalist is a real NUCC concept with no board certificate:
    const hospitalist = resolveNuccCode('208M00000X');
    expect(hospitalist?.mapping.kind).toBe('practice_focus');
    // AOA-certified ONMM is deliberately unmapped (recorded gap, never guessed):
    expect(resolveNuccCode('204D00000X')).toBeUndefined();
  });
});
