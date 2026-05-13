import { describe, expect, it } from 'vitest';

import {
  FILE_TOC,
  buildFileMeta,
  sectionAnchorId,
} from '@/lib/file/fileMeta';

describe('FILE_TOC', () => {
  it('has 8 sections in canonical order', () => {
    expect(FILE_TOC.map((t) => t.id)).toEqual([
      'cover',
      'applicant',
      'readiness',
      'psv',
      'attestation',
      'missing',
      'chain',
      'seal',
    ]);
  });

  it('every entry has a numbered label and page range', () => {
    for (const t of FILE_TOC) {
      expect(t.n).toMatch(/^§[1-8]$/);
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.pages.length).toBeGreaterThan(0);
    }
  });
});

describe('sectionAnchorId', () => {
  it('prefixes sec- to the id', () => {
    expect(sectionAnchorId('cover')).toBe('sec-cover');
    expect(sectionAnchorId('psv')).toBe('sec-psv');
    expect(sectionAnchorId('seal')).toBe('sec-seal');
  });
});

describe('buildFileMeta', () => {
  it('returns a deterministic meta keyed by fileId', () => {
    const m = buildFileMeta('demo-001');
    expect(m.id).toBe('VCV-CF-DEMO-001');
    expect(m.version).toBe(1);
    expect(m.isDemo).toBe(true);
    expect(m.classification).toBe('CONFIDENTIAL · PEER-REVIEW PRIVILEGED');
  });

  it('sanitises hostile fileIds — no HTML smuggling', () => {
    const m = buildFileMeta('<script>alert(1)</script>');
    expect(m.id).not.toContain('<');
    expect(m.id).not.toContain('>');
    expect(m.id).not.toContain('script');
    expect(m.id.startsWith('VCV-CF-')).toBe(true);
  });

  it('caps fileId length at 64 chars (after sanitisation)', () => {
    const longId = 'a'.repeat(200);
    const m = buildFileMeta(longId);
    // Prefix is "VCV-CF-" (7 chars), id portion <= 64.
    expect(m.id.length).toBeLessThanOrEqual(7 + 64);
  });

  it('falls back to a demo id when fileId is empty after sanitisation', () => {
    const m = buildFileMeta('!!!');
    expect(m.id).toBe('VCV-CF-DEMO');
  });

  it('isDemo is the literal true', () => {
    const m = buildFileMeta('any');
    // Type-level check: m.isDemo's static type is `true`. At runtime
    // we still assert the value to catch a future weakening.
    expect(m.isDemo).toBe(true);
  });

  it('classification is the literal CONFIDENTIAL · PEER-REVIEW PRIVILEGED', () => {
    const m = buildFileMeta('any');
    expect(m.classification).toBe('CONFIDENTIAL · PEER-REVIEW PRIVILEGED');
  });
});

describe('buildFileMeta — banned phrases', () => {
  it('renders no banned overclaim copy for any fileId', () => {
    const banned = [
      ['automatically', 'verified'].join(' '),
      ['guaranteed', 'verification'].join(' '),
      ['complete', 'credentialing'].join(' '),
      ['instant', 'credentialing'].join(' '),
      ['legally', 'accepted'].join(' '),
      ['risk', 'transferred'].join(' '),
      ['final', 'verification', 'without', 'review'].join(' '),
      ['source', 'confirmed', 'before', 'response'].join(' '),
      ['certified', 'compliant'].join(' '),
      ['HIPAA', 'compliant'].join(' '),
      ['SOC2', 'certified'].join(' '),
    ];
    const m = buildFileMeta('demo-001');
    const blob = JSON.stringify(m).toLowerCase();
    for (const phrase of banned) {
      expect(blob).not.toContain(phrase.toLowerCase());
    }
  });
});
