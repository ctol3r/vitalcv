import { describe, expect, it } from 'vitest';

import {
  CHAPTER_SCENES,
  getChapterScene,
  SCENE_SCRIM_FLOOR,
} from '@/components/home/scene/registry';

// SHD-1.2.3/1.2.4 contract: chapters DECLARE their scene; legibility floors
// and palette discipline are enforced here, not left to reviewer vigilance.

describe('scene registry (SHD-1.2)', () => {
  it('covers the six-chapter journey with unique, rail-aligned ids', () => {
    const ids = CHAPTER_SCENES.map((c) => c.id);
    expect(ids).toEqual(['wallet', 'evidence', 'matcha', 'apply', 'employers', 'start']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every chapter guarantees at least the scrim floor behind text', () => {
    for (const c of CHAPTER_SCENES) {
      expect(c.scrim, `chapter ${c.id}`).toBeGreaterThanOrEqual(SCENE_SCRIM_FLOOR);
      expect(c.scrim).toBeLessThanOrEqual(1);
    }
  });

  it('keeps decorative motion bounded (flow ≤ 1.5, wake ≤ 1, grain subtle)', () => {
    for (const c of CHAPTER_SCENES) {
      expect(c.flow, `chapter ${c.id} flow`).toBeGreaterThan(0);
      expect(c.flow, `chapter ${c.id} flow`).toBeLessThanOrEqual(1.5);
      expect(c.wake, `chapter ${c.id} wake`).toBeGreaterThanOrEqual(0);
      expect(c.wake, `chapter ${c.id} wake`).toBeLessThanOrEqual(1);
      expect(c.grain, `chapter ${c.id} grain`).toBeGreaterThanOrEqual(0);
      expect(c.grain, `chapter ${c.id} grain`).toBeLessThanOrEqual(0.1);
    }
  });

  it('never uses red as a scene accent — reserved for real fail-closed states', () => {
    for (const c of CHAPTER_SCENES) {
      expect(['emerald', 'indigo', 'amber', 'neutral']).toContain(c.accent);
      expect(['emerald', 'indigo', 'amber', 'neutral']).toContain(c.support);
    }
  });

  it('resolves unknown chapter ids to the hero scene instead of crashing', () => {
    expect(getChapterScene('nope').id).toBe('wallet');
    expect(getChapterScene('evidence').id).toBe('evidence');
  });

  it('is deeply frozen — chapters cannot be mutated at runtime', () => {
    expect(Object.isFrozen(CHAPTER_SCENES)).toBe(true);
    expect(() => {
      (CHAPTER_SCENES[0] as { flow: number }).flow = 99;
    }).toThrow();
  });
});
