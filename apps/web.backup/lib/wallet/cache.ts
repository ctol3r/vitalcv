/**
 * Wallet Cache
 * Client-side caching layer for credentials
 */

import type { CredentialListItem, WalletCacheEntry } from './types';

const CACHE_KEY = 'vitalcv_wallet_cache';
const CACHE_VERSION = '1.0';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class WalletCache {
  static get(): CredentialListItem[] | null {
    if (typeof window === 'undefined') return null;

    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const entry: WalletCacheEntry = JSON.parse(cached);

      // Check version
      if (entry.version !== CACHE_VERSION) {
        this.clear();
        return null;
      }

      // Check TTL
      const age = Date.now() - entry.timestamp;
      if (age > CACHE_TTL) {
        this.clear();
        return null;
      }

      return entry.credentials;
    } catch (error) {
      console.warn('[WalletCache] Failed to read cache:', error);
      return null;
    }
  }

  static set(credentials: CredentialListItem[]): void {
    if (typeof window === 'undefined') return;

    try {
      const entry: WalletCacheEntry = {
        credentials,
        timestamp: Date.now(),
        version: CACHE_VERSION,
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    } catch (error) {
      console.warn('[WalletCache] Failed to write cache:', error);
    }
  }

  static clear(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CACHE_KEY);
  }

  static invalidate(): void {
    this.clear();
  }
}








