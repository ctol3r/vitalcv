/**
 * Provider-Type Loader Tests
 * B111B-PSV-023: Provider-type loader: remediation hints for unknown type
 *
 * Tests for provider type normalization, mapping hints, and remediation messages.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeProviderType,
  getUnknownTypeRemediationMessage,
  getSupportedProviderTypes,
  getProviderTypeMappingHints,
  SUPPORTED_PROVIDER_TYPES,
  PROVIDER_TYPE_MAPPING_HINTS,
} from '../provider-type';

describe('B111B-PSV-023: Provider-Type Loader', () => {
  describe('normalizeProviderType', () => {
    it('should normalize supported provider types', () => {
      expect(normalizeProviderType('physician')).toBe('physician');
      expect(normalizeProviderType('nurse')).toBe('nurse');
      expect(normalizeProviderType('physician_assistant')).toBe('physician_assistant');
    });

    it('should normalize provider type variations using mapping hints', () => {
      expect(normalizeProviderType('md')).toBe('physician');
      expect(normalizeProviderType('doctor')).toBe('physician');
      expect(normalizeProviderType('rn')).toBe('nurse');
      expect(normalizeProviderType('pa')).toBe('physician_assistant');
      expect(normalizeProviderType('np')).toBe('nurse_practitioner');
      expect(normalizeProviderType('aprn')).toBe('nurse_practitioner');
    });

    it('should handle case-insensitive input', () => {
      expect(normalizeProviderType('PHYSICIAN')).toBe('physician');
      expect(normalizeProviderType('MD')).toBe('physician');
      expect(normalizeProviderType('Nurse')).toBe('nurse');
    });

    it('should handle whitespace', () => {
      expect(normalizeProviderType('  physician  ')).toBe('physician');
      expect(normalizeProviderType('  md  ')).toBe('physician');
    });

    it('should return null for unknown types', () => {
      expect(normalizeProviderType('unknown_type')).toBeNull();
      expect(normalizeProviderType('xyz123')).toBeNull();
    });
  });

  describe('getUnknownTypeRemediationMessage', () => {
    it('should return remediation message for unknown type', () => {
      const message = getUnknownTypeRemediationMessage('unknown_type');

      expect(message).toContain('Unknown provider type');
      expect(message).toContain('unknown_type');
      expect(message).toContain('Supported types');
      expect(message).toContain(SUPPORTED_PROVIDER_TYPES.length.toString());
    });

    it('should include list of supported types', () => {
      const message = getUnknownTypeRemediationMessage('unknown');
      const supportedTypes = getSupportedProviderTypes();

      supportedTypes.forEach(type => {
        expect(message).toContain(type);
      });
    });

    it('should include mapping guidance when similar hints exist', () => {
      const message = getUnknownTypeRemediationMessage('med');

      // Should suggest physician mapping if similar
      expect(message).toContain('mapping hints') || expect(message).toContain('PROVIDER_TYPE_MAPPING_HINTS');
    });

    it('should include instructions for adding new types', () => {
      const message = getUnknownTypeRemediationMessage('new_type');

      expect(message).toContain('SUPPORTED_PROVIDER_TYPES');
      expect(message).toContain('PROVIDER_TYPE_MAPPING_HINTS');
      expect(message).toContain('services/psv/loaders/provider-type.ts');
    });

    it('should handle mapped types correctly', () => {
      const message = getUnknownTypeRemediationMessage('md');

      // md maps to physician, so should return mapping message
      expect(message).toContain('maps to') || expect(message).toContain('physician');
    });
  });

  describe('getSupportedProviderTypes', () => {
    it('should return array of supported provider types', () => {
      const types = getSupportedProviderTypes();

      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
      expect(types).toContain('physician');
      expect(types).toContain('nurse');
    });

    it('should return copy of supported types array', () => {
      const types1 = getSupportedProviderTypes();
      const types2 = getSupportedProviderTypes();

      expect(types1).toEqual(types2);
      expect(types1).not.toBe(SUPPORTED_PROVIDER_TYPES); // Should be a copy
    });
  });

  describe('getProviderTypeMappingHints', () => {
    it('should return mapping hints object', () => {
      const hints = getProviderTypeMappingHints();

      expect(typeof hints).toBe('object');
      expect(Object.keys(hints).length).toBeGreaterThan(0);
    });

    it('should include common mappings', () => {
      const hints = getProviderTypeMappingHints();

      expect(hints['md']).toBe('physician');
      expect(hints['rn']).toBe('nurse');
      expect(hints['pa']).toBe('physician_assistant');
      expect(hints['np']).toBe('nurse_practitioner');
    });

    it('should return copy of mapping hints', () => {
      const hints1 = getProviderTypeMappingHints();
      const hints2 = getProviderTypeMappingHints();

      expect(hints1).toEqual(hints2);
      expect(hints1).not.toBe(PROVIDER_TYPE_MAPPING_HINTS); // Should be a copy
    });
  });

  describe('Integration: Unknown type handling', () => {
    it('should provide helpful remediation for completely unknown types', () => {
      const unknownType = 'completely_unknown_type_xyz';
      const message = getUnknownTypeRemediationMessage(unknownType);

      expect(message).toContain(unknownType);
      expect(message).toContain('Supported types');
      expect(message).toContain('PROVIDER_TYPE_MAPPING_HINTS');
    });

    it('should suggest similar mappings when available', () => {
      // Test with a type that might have similar mappings
      const message = getUnknownTypeRemediationMessage('nurs');

      // Should either map to nurse or suggest similar mappings
      const normalized = normalizeProviderType('nurs');
      if (normalized) {
        expect(message).toContain('maps to');
      } else {
        // Should suggest nurse-related mappings
        expect(message.toLowerCase()).toContain('nurse') || expect(message).toContain('mapping hints');
      }
    });
  });
});

