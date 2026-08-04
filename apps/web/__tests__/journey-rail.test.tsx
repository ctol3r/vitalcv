import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { JOURNEY_CHAPTER_IDS, JOURNEY_CHAPTERS } from '@/components/home/journey';
import { JourneyCard } from '@/components/home/rail/JourneyCard';
import { railLeafTransform, rolodexLeafVisible } from '@/lib/home/rolodex';
import { railChapterProgress } from '@/components/home/scene/progress';

// W2 contracts: the four-chapter journey model, the rotary-file leaf poses
// (same physical language as the reviewed vertical rolodex), and the
// rail→driver bridge.

describe('journey model (W2.1)', () => {
  it('is exactly the four audit chapters, in order, with real destinations', () => {
    expect(JOURNEY_CHAPTER_IDS).toEqual(['readiness', 'matcha', 'apply', 'start']);
    expect(JOURNEY_CHAPTERS.map((c) => c.label)).toEqual([
      'See what is ready',
      'Find roles that fit',
      'Apply with proof',
      // Was 'Start faster' — retired with the speed hero (brand split 2026-07-26).
      'Start from evidence',
    ]);
    for (const chapter of JOURNEY_CHAPTERS) {
      expect(chapter.href.startsWith('/') || chapter.href.startsWith('#'), `${chapter.id} href`).toBe(
        true,
      );
      expect(chapter.rows.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps the truth rails: gated licensure, institution boundary, no bare verified', () => {
    const allDetails = JOURNEY_CHAPTERS.flatMap((c) => c.rows.map((r) => r.detail)).join(' · ');
    expect(allDetails).toContain('Access required');
    expect(allDetails).toContain('Institution review remains');
    // No status label may be the bare word "Verified" (truth contract).
    for (const row of JOURNEY_CHAPTERS.flatMap((c) => c.rows)) {
      expect(row.detail.trim().toLowerCase()).not.toBe('verified');
    }
  });

  it('every card marks itself Illustrative and links its action', () => {
    for (const chapter of JOURNEY_CHAPTERS) {
      const html = renderToStaticMarkup(<JourneyCard chapter={chapter} />);
      expect(html).toContain('Illustrative');
      expect(html).toContain(`data-journey-card="${chapter.id}"`);
      expect(html).toContain(`data-journey-action="${chapter.id}"`);
      expect(html).toContain(`href="${chapter.href}"`);
    }
  });
});

describe('rail leaf poses (W2.2)', () => {
  it('the active leaf rests centered, front-facing, fully opaque', () => {
    const pose = railLeafTransform(0);
    expect(pose.rotateX).toBe(0);
    expect(pose.y).toBe(0);
    expect(pose.scale).toBe(1);
    expect(pose.opacity).toBe(1);
  });

  it('completed leaves fan up/back; upcoming leaves fan down/forward', () => {
    const prev = railLeafTransform(-1);
    const next = railLeafTransform(1);
    expect(prev.rotateX).toBeGreaterThan(0); // tilts away above the spindle
    expect(prev.y).toBeLessThan(0); // rises
    expect(next.rotateX).toBeLessThan(0); // leans in from below
    expect(next.y).toBeGreaterThan(0); // sits lower
  });

  it('two leaves each side stay visible; beyond the fan is culled', () => {
    for (const off of [-2, -1, 1, 2]) expect(rolodexLeafVisible(off)).toBe(true);
    for (const off of [-3, 3]) expect(rolodexLeafVisible(off)).toBe(false);
  });

  it('the active leaf always sits frontmost', () => {
    const zs = [-2, -1, 0, 1, 2].map((o) => railLeafTransform(o).zIndex);
    expect(Math.max(...zs)).toBe(railLeafTransform(0).zIndex);
  });
});

describe('rail → chapter-driver bridge (W2 + one-driver rule)', () => {
  it('maps runway progress onto the journey ids with scene blends', () => {
    const start = railChapterProgress(JOURNEY_CHAPTER_IDS, 0)!;
    expect(start.id).toBe('readiness');
    expect(start.blend.t).toBe(0);

    const end = railChapterProgress(JOURNEY_CHAPTER_IDS, 1)!;
    expect(end.id).toBe('start');
    expect(end.global).toBe(JOURNEY_CHAPTER_IDS.length - 1);

    const mid = railChapterProgress(JOURNEY_CHAPTER_IDS, 0.5)!;
    expect(['matcha', 'apply']).toContain(mid.id);
  });

  it('clamps out-of-range progress and stays pure (reverse parity)', () => {
    expect(railChapterProgress(JOURNEY_CHAPTER_IDS, -0.5)!.id).toBe('readiness');
    expect(railChapterProgress(JOURNEY_CHAPTER_IDS, 1.5)!.id).toBe('start');
    const a = railChapterProgress(JOURNEY_CHAPTER_IDS, 0.37);
    const b = railChapterProgress(JOURNEY_CHAPTER_IDS, 0.37);
    expect(a).toEqual(b);
  });
});
