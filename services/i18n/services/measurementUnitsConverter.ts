/**
 * B241A-I18N-010: MeasurementUnitsConverter
 *
 * Converts units (e.g., metric to imperial) for:
 * - Lengths
 * - Weights
 * - Volumes
 * - Temperatures
 * Accepts unit type and value
 * Returns converted value and unit
 * Includes tests
 */

export type UnitType = 'length' | 'weight' | 'volume' | 'temperature';

export interface ConversionInput {
  value: number;
  fromUnit: string;
  toUnit: string;
  unitType: UnitType;
}

export interface ConversionOutput {
  value: number;
  unit: string;
  originalValue: number;
  originalUnit: string;
}

/**
 * MeasurementUnitsConverter
 *
 * Converts between measurement units
 */
export class MeasurementUnitsConverter {
  /**
   * Convert a value from one unit to another
   */
  convert(input: ConversionInput): ConversionOutput {
    switch (input.unitType) {
      case 'length':
        return this.convertLength(input);
      case 'weight':
        return this.convertWeight(input);
      case 'volume':
        return this.convertVolume(input);
      case 'temperature':
        return this.convertTemperature(input);
      default:
        throw new Error(`Unsupported unit type: ${input.unitType}`);
    }
  }

  /**
   * Convert length units
   */
  private convertLength(input: ConversionInput): ConversionOutput {
    const conversions: Record<string, number> = {
      // To meters
      mm: 0.001,
      cm: 0.01,
      m: 1,
      km: 1000,
      in: 0.0254,
      ft: 0.3048,
      yd: 0.9144,
      mi: 1609.344,
    };

    const fromMeters = input.value / (conversions[input.fromUnit] || 1);
    const toValue = fromMeters * (conversions[input.toUnit] || 1);

    return {
      value: this.round(toValue, 6),
      unit: input.toUnit,
      originalValue: input.value,
      originalUnit: input.fromUnit,
    };
  }

  /**
   * Convert weight units
   */
  private convertWeight(input: ConversionInput): ConversionOutput {
    const conversions: Record<string, number> = {
      // To kilograms
      mg: 0.000001,
      g: 0.001,
      kg: 1,
      oz: 0.0283495,
      lb: 0.453592,
      st: 6.35029,
      t: 1000,
    };

    const fromKilograms = input.value / (conversions[input.fromUnit] || 1);
    const toValue = fromKilograms * (conversions[input.toUnit] || 1);

    return {
      value: this.round(toValue, 6),
      unit: input.toUnit,
      originalValue: input.value,
      originalUnit: input.fromUnit,
    };
  }

  /**
   * Convert volume units
   */
  private convertVolume(input: ConversionInput): ConversionOutput {
    const conversions: Record<string, number> = {
      // To liters
      ml: 0.001,
      l: 1,
      'fl oz': 0.0295735,
      cup: 0.236588,
      pt: 0.473176,
      qt: 0.946353,
      gal: 3.78541,
      'm³': 1000,
    };

    const fromLiters = input.value / (conversions[input.fromUnit] || 1);
    const toValue = fromLiters * (conversions[input.toUnit] || 1);

    return {
      value: this.round(toValue, 6),
      unit: input.toUnit,
      originalValue: input.value,
      originalUnit: input.fromUnit,
    };
  }

  /**
   * Convert temperature units
   */
  private convertTemperature(input: ConversionInput): ConversionOutput {
    let celsius: number;

    // Convert to Celsius first
    switch (input.fromUnit.toLowerCase()) {
      case 'c':
      case 'celsius':
        celsius = input.value;
        break;
      case 'f':
      case 'fahrenheit':
        celsius = (input.value - 32) * (5 / 9);
        break;
      case 'k':
      case 'kelvin':
        celsius = input.value - 273.15;
        break;
      default:
        throw new Error(`Unsupported temperature unit: ${input.fromUnit}`);
    }

    // Convert from Celsius to target unit
    let toValue: number;
    switch (input.toUnit.toLowerCase()) {
      case 'c':
      case 'celsius':
        toValue = celsius;
        break;
      case 'f':
      case 'fahrenheit':
        toValue = celsius * (9 / 5) + 32;
        break;
      case 'k':
      case 'kelvin':
        toValue = celsius + 273.15;
        break;
      default:
        throw new Error(`Unsupported temperature unit: ${input.toUnit}`);
    }

    return {
      value: this.round(toValue, 2),
      unit: input.toUnit,
      originalValue: input.value,
      originalUnit: input.fromUnit,
    };
  }

  /**
   * Round to specified decimal places
   */
  private round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  /**
   * Get supported units for a type
   */
  getSupportedUnits(unitType: UnitType): string[] {
    switch (unitType) {
      case 'length':
        return ['mm', 'cm', 'm', 'km', 'in', 'ft', 'yd', 'mi'];
      case 'weight':
        return ['mg', 'g', 'kg', 'oz', 'lb', 'st', 't'];
      case 'volume':
        return ['ml', 'l', 'fl oz', 'cup', 'pt', 'qt', 'gal', 'm³'];
      case 'temperature':
        return ['c', 'celsius', 'f', 'fahrenheit', 'k', 'kelvin'];
      default:
        return [];
    }
  }

  /**
   * Check if unit is supported for a type
   */
  isUnitSupported(unitType: UnitType, unit: string): boolean {
    return this.getSupportedUnits(unitType).includes(unit.toLowerCase());
  }
}

