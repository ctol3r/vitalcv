import { detectExpirationDrift, summarizeDrift } from '../expirationDrift';

describe('expirationDrift', () => {
  describe('detectExpirationDrift', () => {
    it('returns unknown when either side is null', () => {
      const r = detectExpirationDrift('a', null, '2026-06-01T00:00:00.000Z');
      expect(r.driftDirection).toBe('unknown');
      expect(r.driftDays).toBeNull();
      expect(r.operatorVisible).toBe(true);
    });

    it('reports later when observed is after forecast', () => {
      const r = detectExpirationDrift(
        'a',
        '2026-06-01T00:00:00.000Z',
        '2026-06-11T00:00:00.000Z',
      );
      expect(r.driftDirection).toBe('later');
      expect(r.driftDays).toBe(10);
    });

    it('reports earlier when observed is before forecast', () => {
      const r = detectExpirationDrift(
        'a',
        '2026-06-15T00:00:00.000Z',
        '2026-06-10T00:00:00.000Z',
      );
      expect(r.driftDirection).toBe('earlier');
      expect(r.driftDays).toBe(-5);
    });

    it('reports on_time when forecast and observed match', () => {
      const r = detectExpirationDrift(
        'a',
        '2026-06-01T00:00:00.000Z',
        '2026-06-01T00:00:00.000Z',
      );
      expect(r.driftDirection).toBe('on_time');
      expect(r.driftDays).toBe(0);
    });

    it('always sets operatorVisible to literal true', () => {
      const inputs: Array<[string, string | null, string | null]> = [
        ['a', null, null],
        ['b', '2026-01-01T00:00:00.000Z', null],
        ['c', null, '2026-01-01T00:00:00.000Z'],
        ['d', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'],
      ];
      for (const [id, f, o] of inputs) {
        expect(detectExpirationDrift(id, f, o).operatorVisible).toBe(true);
      }
    });
  });

  describe('summarizeDrift', () => {
    it('aggregates counts by direction', () => {
      const reports = [
        detectExpirationDrift('a', '2026-06-01T00:00:00.000Z', '2026-06-11T00:00:00.000Z'),
        detectExpirationDrift('b', '2026-06-01T00:00:00.000Z', '2026-05-25T00:00:00.000Z'),
        detectExpirationDrift('c', '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'),
        detectExpirationDrift('d', null, null),
      ];
      const sum = summarizeDrift(reports);
      expect(sum.total).toBe(4);
      expect(sum.later).toBe(1);
      expect(sum.earlier).toBe(1);
      expect(sum.onTime).toBe(1);
      expect(sum.unknown).toBe(1);
      expect(sum.maxAbsoluteDriftDays).toBe(10);
    });
  });
});
