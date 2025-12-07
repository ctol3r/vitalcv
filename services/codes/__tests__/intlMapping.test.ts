/**
 * B139A-INTL-010: Tests for International Code Mapping
 */

import {
  mapCptCode,
  batchMapCptCodes,
  getAllMappings,
  reverseLookup,
  hasMappingFor,
  getMappingConfidence,
  filterByConfidence,
  CodeSystem,
  CPT_TO_ICD10_AM,
  CPT_TO_ICD10_CA,
} from '../intlMapping';

describe('International Code Mapping', () => {
  describe('mapCptCode', () => {
    it('should map CPT to ICD-10-AM', () => {
      const mapping = mapCptCode('93000', CodeSystem.ICD_10_AM);

      expect(mapping).not.toBeNull();
      expect(mapping?.sourceCode).toBe('93000');
      expect(mapping?.targetCode).toBe('55111-00');
      expect(mapping?.targetSystem).toBe(CodeSystem.ICD_10_AM);
      expect(mapping?.confidence).toBe('exact');
    });

    it('should map CPT to ICD-10-CA', () => {
      const mapping = mapCptCode('93000', CodeSystem.ICD_10_CA);

      expect(mapping).not.toBeNull();
      expect(mapping?.sourceCode).toBe('93000');
      expect(mapping?.targetCode).toBe('3.EN.10.^^');
      expect(mapping?.targetSystem).toBe(CodeSystem.ICD_10_CA);
    });

    it('should return null for unmapped code', () => {
      const mapping = mapCptCode('99999', CodeSystem.ICD_10_AM);

      expect(mapping).toBeNull();
    });

    it('should return null for unsupported target system', () => {
      const mapping = mapCptCode('93000', CodeSystem.SNOMED_CT);

      expect(mapping).toBeNull();
    });
  });

  describe('batchMapCptCodes', () => {
    it('should map multiple CPT codes', () => {
      const codes = ['93000', '99213', '80053'];
      const mappings = batchMapCptCodes(codes, CodeSystem.ICD_10_AM);

      expect(mappings.size).toBe(3);
      expect(mappings.get('93000')).not.toBeNull();
      expect(mappings.get('99213')).not.toBeNull();
      expect(mappings.get('80053')).not.toBeNull();
    });

    it('should handle mix of mapped and unmapped codes', () => {
      const codes = ['93000', '99999'];
      const mappings = batchMapCptCodes(codes, CodeSystem.ICD_10_AM);

      expect(mappings.get('93000')).not.toBeNull();
      expect(mappings.get('99999')).toBeNull();
    });
  });

  describe('getAllMappings', () => {
    it('should return all ICD-10-AM mappings', () => {
      const mappings = getAllMappings(CodeSystem.ICD_10_AM);

      expect(mappings.length).toBeGreaterThan(0);
      expect(mappings).toEqual(CPT_TO_ICD10_AM);
    });

    it('should return all ICD-10-CA mappings', () => {
      const mappings = getAllMappings(CodeSystem.ICD_10_CA);

      expect(mappings.length).toBeGreaterThan(0);
      expect(mappings).toEqual(CPT_TO_ICD10_CA);
    });

    it('should return empty array for unsupported system', () => {
      const mappings = getAllMappings(CodeSystem.SNOMED_CT);

      expect(mappings).toEqual([]);
    });
  });

  describe('reverseLookup', () => {
    it('should find CPT code from ICD-10-AM code', () => {
      const mapping = reverseLookup('55111-00', CodeSystem.ICD_10_AM);

      expect(mapping).not.toBeNull();
      expect(mapping?.sourceCode).toBe('93000');
      expect(mapping?.targetCode).toBe('55111-00');
    });

    it('should find CPT code from ICD-10-CA code', () => {
      const mapping = reverseLookup('3.EN.10.^^', CodeSystem.ICD_10_CA);

      expect(mapping).not.toBeNull();
      expect(mapping?.sourceCode).toBe('93000');
    });

    it('should return null for unmapped target code', () => {
      const mapping = reverseLookup('999-UNKNOWN', CodeSystem.ICD_10_AM);

      expect(mapping).toBeNull();
    });
  });

  describe('hasMappingFor', () => {
    it('should return true for mapped codes', () => {
      expect(hasMappingFor('93000', CodeSystem.ICD_10_AM)).toBe(true);
      expect(hasMappingFor('99213', CodeSystem.ICD_10_CA)).toBe(true);
    });

    it('should return false for unmapped codes', () => {
      expect(hasMappingFor('99999', CodeSystem.ICD_10_AM)).toBe(false);
      expect(hasMappingFor('99999', CodeSystem.ICD_10_CA)).toBe(false);
    });
  });

  describe('getMappingConfidence', () => {
    it('should return confidence level for mapped code', () => {
      expect(getMappingConfidence('93000', CodeSystem.ICD_10_AM)).toBe('exact');
      expect(getMappingConfidence('99213', CodeSystem.ICD_10_AM)).toBe('approximate');
    });

    it('should return "none" for unmapped code', () => {
      expect(getMappingConfidence('99999', CodeSystem.ICD_10_AM)).toBe('none');
    });
  });

  describe('filterByConfidence', () => {
    it('should filter exact mappings only', () => {
      const allMappings = getAllMappings(CodeSystem.ICD_10_AM);
      const exactMappings = filterByConfidence(allMappings, 'exact');

      expect(exactMappings.every(m => m.confidence === 'exact')).toBe(true);
    });

    it('should filter exact and approximate mappings', () => {
      const allMappings = getAllMappings(CodeSystem.ICD_10_AM);
      const filtered = filterByConfidence(allMappings, 'approximate');

      expect(
        filtered.every(m => m.confidence === 'exact' || m.confidence === 'approximate')
      ).toBe(true);
    });
  });

  describe('Sample mappings validation', () => {
    it('should have valid ICD-10-AM mappings', () => {
      expect(CPT_TO_ICD10_AM.length).toBeGreaterThan(0);

      for (const mapping of CPT_TO_ICD10_AM) {
        expect(mapping.sourceCode).toBeDefined();
        expect(mapping.sourceSystem).toBe(CodeSystem.CPT);
        expect(mapping.targetCode).toBeDefined();
        expect(mapping.targetSystem).toBe(CodeSystem.ICD_10_AM);
        expect(mapping.display).toBeDefined();
        expect(['exact', 'approximate', 'narrow', 'broad']).toContain(mapping.confidence);
      }
    });

    it('should have valid ICD-10-CA mappings', () => {
      expect(CPT_TO_ICD10_CA.length).toBeGreaterThan(0);

      for (const mapping of CPT_TO_ICD10_CA) {
        expect(mapping.sourceCode).toBeDefined();
        expect(mapping.sourceSystem).toBe(CodeSystem.CPT);
        expect(mapping.targetCode).toBeDefined();
        expect(mapping.targetSystem).toBe(CodeSystem.ICD_10_CA);
        expect(mapping.display).toBeDefined();
        expect(['exact', 'approximate', 'narrow', 'broad']).toContain(mapping.confidence);
      }
    });
  });
});

