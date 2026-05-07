import { describe, expect, it } from 'vitest';

import {
  DOC_CLASS_META,
  INBOX_PROVENANCE_META,
  computeInboxStats,
  demoInbox,
  formatBytes,
} from '@/lib/inbox/inboxData';

const BANNED = [
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

describe('INBOX_PROVENANCE_META', () => {
  it('has 5 provenance states', () => {
    expect(Object.keys(INBOX_PROVENANCE_META)).toEqual([
      'source_confirmed',
      'inferred',
      'user_entered',
      'unknown',
      'contradicted',
    ]);
  });

  it('does NOT use the bare label "Verified" for any provenance', () => {
    // CLAUDE.md bans bare "Verified" as a status label. The strongest
    // provenance is mapped to "Source-confirmed" instead.
    for (const meta of Object.values(INBOX_PROVENANCE_META)) {
      expect(meta.label).not.toBe('Verified');
    }
    expect(INBOX_PROVENANCE_META.source_confirmed.label).toBe('Source-confirmed');
  });
});

describe('DOC_CLASS_META', () => {
  it('has 8 document classifications', () => {
    expect(Object.keys(DOC_CLASS_META)).toEqual([
      'cv',
      'state_license',
      'board_cert',
      'dea',
      'malpractice',
      'diploma',
      'attestation',
      'unknown',
    ]);
  });

  it('uses a vendor-neutral label for the controlled-substance authority class', () => {
    // CR-3 Element D is named "DEA" by NCQA but the user-facing
    // label intentionally avoids naming a specific upstream vendor
    // because no real DEA integration is wired today.
    expect(DOC_CLASS_META.dea.label).not.toContain('DEA');
    expect(DOC_CLASS_META.dea.label).toBe('Controlled-Substance Authority');
  });
});

describe('formatBytes', () => {
  it('renders bytes under 1 kB as B', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
  });

  it('renders kB when 1 kB ≤ b < 1 MB', () => {
    expect(formatBytes(1024)).toBe('1.0 kB');
    expect(formatBytes(184_392)).toBe('180.1 kB');
  });

  it('renders MB when b ≥ 1 MB', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(2_840_122)).toBe('2.7 MB');
  });
});

describe('demoInbox', () => {
  it('returns an InboxState with isDemo === literal true', () => {
    const s = demoInbox();
    expect(s.isDemo).toBe(true);
  });

  it('has 5 demo documents covering processed / classifying / unclassified', () => {
    const s = demoInbox();
    expect(s.documents.length).toBe(5);
    const states = s.documents.map((d) => d.state);
    expect(states.filter((x) => x === 'processed').length).toBe(3);
    expect(states.filter((x) => x === 'classifying').length).toBe(1);
    expect(states.filter((x) => x === 'unclassified').length).toBe(1);
  });

  it('classifying document carries null classification + null confidence', () => {
    const s = demoInbox();
    const c = s.documents.find((d) => d.state === 'classifying');
    expect(c?.classification).toBeNull();
    expect(c?.classificationConfidence).toBeNull();
    expect(c?.extractedCount).toBe(0);
  });

  it('every extracted field uses a non-banned provenance', () => {
    const s = demoInbox();
    const valid = new Set(Object.keys(INBOX_PROVENANCE_META));
    for (const list of Object.values(s.extractions)) {
      for (const f of list) {
        expect(valid.has(f.provenance)).toBe(true);
      }
    }
  });

  it('renders no banned overclaim copy in any string field', () => {
    const s = demoInbox();
    const blob = JSON.stringify({ s, INBOX_PROVENANCE_META, DOC_CLASS_META }).toLowerCase();
    for (const phrase of BANNED) {
      expect(blob).not.toContain(phrase.toLowerCase());
    }
  });
});

describe('computeInboxStats', () => {
  it('matches the demoInbox composition', () => {
    const s = demoInbox();
    const stats = computeInboxStats(s);
    expect(stats.docCount).toBe(5);
    expect(stats.processed).toBe(3);
    expect(stats.classifying).toBe(1);
    expect(stats.unclassified).toBe(1);
    // demoInbox has 4+4+3 = 11 extractions across 3 processed docs.
    expect(stats.extractedFields).toBe(11);
    expect(stats.suggestionCount).toBe(3);
  });

  it('returns all zeros for an empty inbox', () => {
    const stats = computeInboxStats({
      isDemo: true,
      documents: [],
      extractions: {},
      suggestions: [],
    });
    expect(stats).toEqual({
      docCount: 0,
      processed: 0,
      classifying: 0,
      unclassified: 0,
      extractedFields: 0,
      suggestionCount: 0,
    });
  });
});
