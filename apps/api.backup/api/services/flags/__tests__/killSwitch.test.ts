/**
 * B149A-FF-006: Kill-switch helper tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  killSwitch,
  reviveSwitch,
  isKilled,
  getKilledFlags,
  clearKilledFlags,
  isFeatureEnabled,
} from '../killSwitch';

describe('Kill Switch', () => {
  beforeEach(() => {
    clearKilledFlags();
  });

  describe('killSwitch', () => {
    it('should kill a feature flag', () => {
      killSwitch('testFlag');
      expect(isKilled('testFlag')).toBe(true);
    });

    it('should handle multiple flags', () => {
      killSwitch('flag1');
      killSwitch('flag2');
      expect(isKilled('flag1')).toBe(true);
      expect(isKilled('flag2')).toBe(true);
    });
  });

  describe('reviveSwitch', () => {
    it('should revive a killed flag', () => {
      killSwitch('testFlag');
      expect(isKilled('testFlag')).toBe(true);

      reviveSwitch('testFlag');
      expect(isKilled('testFlag')).toBe(false);
    });

    it('should handle reviving non-killed flag gracefully', () => {
      reviveSwitch('nonexistent');
      expect(isKilled('nonexistent')).toBe(false);
    });
  });

  describe('isKilled', () => {
    it('should return false for non-killed flags', () => {
      expect(isKilled('testFlag')).toBe(false);
    });

    it('should return true for killed flags', () => {
      killSwitch('testFlag');
      expect(isKilled('testFlag')).toBe(true);
    });
  });

  describe('getKilledFlags', () => {
    it('should return empty array when no flags are killed', () => {
      expect(getKilledFlags()).toEqual([]);
    });

    it('should return all killed flags', () => {
      killSwitch('flag1');
      killSwitch('flag2');
      const killed = getKilledFlags();
      expect(killed).toContain('flag1');
      expect(killed).toContain('flag2');
      expect(killed.length).toBe(2);
    });
  });

  describe('clearKilledFlags', () => {
    it('should clear all killed flags', () => {
      killSwitch('flag1');
      killSwitch('flag2');
      expect(getKilledFlags().length).toBe(2);

      clearKilledFlags();
      expect(getKilledFlags().length).toBe(0);
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return false if flag is killed', async () => {
      killSwitch('testFlag');

      const getFlagFn = jest.fn().mockResolvedValue({ value: true });

      const result = await isFeatureEnabled(getFlagFn, 'testFlag');

      expect(result).toBe(false);
      expect(getFlagFn).not.toHaveBeenCalled();
    });

    it('should return true if flag is not killed and getFlag returns true', async () => {
      const getFlagFn = jest.fn().mockResolvedValue({ value: true });

      const result = await isFeatureEnabled(getFlagFn, 'testFlag');

      expect(result).toBe(true);
      expect(getFlagFn).toHaveBeenCalled();
    });

    it('should return false if flag is not killed and getFlag returns false', async () => {
      const getFlagFn = jest.fn().mockResolvedValue({ value: false });

      const result = await isFeatureEnabled(getFlagFn, 'testFlag');

      expect(result).toBe(false);
      expect(getFlagFn).toHaveBeenCalled();
    });

    it('should handle boolean values directly', async () => {
      const getFlagFn = jest.fn().mockResolvedValue(true);

      const result = await isFeatureEnabled(getFlagFn, 'testFlag');

      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      const getFlagFn = jest.fn().mockRejectedValue(new Error('DB error'));

      const result = await isFeatureEnabled(getFlagFn, 'testFlag');

      expect(result).toBe(false);
    });
  });
});

