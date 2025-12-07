/**
 * B241A-I18N-010: MeasurementUnitsConverter tests
 */

import { MeasurementUnitsConverter } from '../measurementUnitsConverter';

describe('MeasurementUnitsConverter', () => {
  let converter: MeasurementUnitsConverter;

  beforeEach(() => {
    converter = new MeasurementUnitsConverter();
  });

  describe('convert - length', () => {
    it('should convert meters to feet', () => {
      const result = converter.convert({
        value: 1,
        fromUnit: 'm',
        toUnit: 'ft',
        unitType: 'length',
      });

      expect(result.value).toBeCloseTo(3.28084, 2);
      expect(result.unit).toBe('ft');
    });

    it('should convert inches to centimeters', () => {
      const result = converter.convert({
        value: 1,
        fromUnit: 'in',
        toUnit: 'cm',
        unitType: 'length',
      });

      expect(result.value).toBeCloseTo(2.54, 2);
    });
  });

  describe('convert - weight', () => {
    it('should convert pounds to kilograms', () => {
      const result = converter.convert({
        value: 1,
        fromUnit: 'lb',
        toUnit: 'kg',
        unitType: 'weight',
      });

      expect(result.value).toBeCloseTo(0.453592, 3);
    });
  });

  describe('convert - volume', () => {
    it('should convert gallons to liters', () => {
      const result = converter.convert({
        value: 1,
        fromUnit: 'gal',
        toUnit: 'l',
        unitType: 'volume',
      });

      expect(result.value).toBeCloseTo(3.78541, 2);
    });
  });

  describe('convert - temperature', () => {
    it('should convert Celsius to Fahrenheit', () => {
      const result = converter.convert({
        value: 0,
        fromUnit: 'c',
        toUnit: 'f',
        unitType: 'temperature',
      });

      expect(result.value).toBe(32);
    });

    it('should convert Fahrenheit to Celsius', () => {
      const result = converter.convert({
        value: 32,
        fromUnit: 'f',
        toUnit: 'c',
        unitType: 'temperature',
      });

      expect(result.value).toBe(0);
    });

    it('should convert Celsius to Kelvin', () => {
      const result = converter.convert({
        value: 0,
        fromUnit: 'c',
        toUnit: 'k',
        unitType: 'temperature',
      });

      expect(result.value).toBeCloseTo(273.15, 2);
    });
  });

  describe('getSupportedUnits', () => {
    it('should return supported length units', () => {
      const units = converter.getSupportedUnits('length');
      expect(units).toContain('m');
      expect(units).toContain('ft');
      expect(units).toContain('in');
    });
  });
});

