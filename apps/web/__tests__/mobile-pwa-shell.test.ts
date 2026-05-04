import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const SW_PATH = join(__dirname, '../public/sw.js');
const swSource = readFileSync(SW_PATH, 'utf-8');

describe('mobile PWA shell — service worker truth contract', () => {
  it('does NOT cache /api/* routes (Network-First enforced)', () => {
    // The service worker must contain an explicit Network-First guard for /api/*
    // that immediately fetches without touching the cache.
    expect(swSource).toContain("pathname.startsWith('/api/')");
    expect(swSource).toContain('fetch(request)');
    // The guard must appear before any cache.match logic
    const apiGuardIdx = swSource.indexOf("pathname.startsWith('/api/')");
    const cacheMatchIdx = swSource.indexOf('cache.match');
    expect(apiGuardIdx).toBeLessThan(cacheMatchIdx);
  });

  it('does NOT contain offline credentialing or automatic verification copy', () => {
    const banned = [
      'offline credentialing',
      'automatic verification',
      ['automatically', 'verified'].join(' '),
      ['guaranteed', 'verification'].join(' '),
    ];
    for (const phrase of banned) {
      expect(swSource.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });
});
