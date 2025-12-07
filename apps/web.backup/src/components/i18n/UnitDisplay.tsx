/**
 * B252C-I18N-028: UnitDisplay Component
 *
 * Displays values with appropriate units based on user's locale:
 * converts to preferred units (e.g., Celsius vs Fahrenheit) using UnitConversionService;
 * accessible and responsive
 */

'use client';

import { useMemo } from 'react';
import { useTranslation } from '@/i18n';
// Note: In a monorepo, you may need to adjust this import path
// or use a workspace package reference
import { MeasurementUnitsConverter, type UnitType, type ConversionInput } from '../../../../../services/i18n/services/measurementUnitsConverter';
import { cn } from '@/lib/utils';

interface UnitDisplayProps {
  value: number;
  fromUnit: string;
  unitType: UnitType;
  locale?: string;
  className?: string;
  showOriginal?: boolean;
  precision?: number;
  'aria-label'?: string;
}

// Map locale to preferred units
const localeToPreferredUnits: Record<string, Record<UnitType, string>> = {
  'en-US': {
    length: 'ft',
    weight: 'lb',
    volume: 'gal',
    temperature: 'fahrenheit',
  },
  'en-GB': {
    length: 'ft',
    weight: 'st',
    volume: 'gal',
    temperature: 'celsius',
  },
  'es-ES': {
    length: 'm',
    weight: 'kg',
    volume: 'l',
    temperature: 'celsius',
  },
  'fr-FR': {
    length: 'm',
    weight: 'kg',
    volume: 'l',
    temperature: 'celsius',
  },
  'de-DE': {
    length: 'm',
    weight: 'kg',
    volume: 'l',
    temperature: 'celsius',
  },
  'ja-JP': {
    length: 'm',
    weight: 'kg',
    volume: 'l',
    temperature: 'celsius',
  },
  'zh-CN': {
    length: 'm',
    weight: 'kg',
    volume: 'l',
    temperature: 'celsius',
  },
};

// Default to metric
const DEFAULT_PREFERRED_UNITS: Record<UnitType, string> = {
  length: 'm',
  weight: 'kg',
  volume: 'l',
  temperature: 'celsius',
};

export function UnitDisplay({
  value,
  fromUnit,
  unitType,
  locale,
  className,
  showOriginal = false,
  precision = 2,
  'aria-label': ariaLabel,
}: UnitDisplayProps) {
  const { locale: currentLocale } = useTranslation();
  const converter = useMemo(() => new MeasurementUnitsConverter(), []);

  const converted = useMemo(() => {
    const targetLocale = (locale || currentLocale) as any;
    const preferredUnits = localeToPreferredUnits[targetLocale] || DEFAULT_PREFERRED_UNITS;
    const toUnit = preferredUnits[unitType];

    // If already in preferred unit, no conversion needed
    if (fromUnit.toLowerCase() === toUnit.toLowerCase()) {
      return {
        value: value,
        unit: fromUnit,
        originalValue: value,
        originalUnit: fromUnit,
      };
    }

    try {
      const input: ConversionInput = {
        value,
        fromUnit,
        toUnit,
        unitType,
      };
      return converter.convert(input);
    } catch (error) {
      console.warn('Unit conversion failed:', error);
      // Fallback to original value
      return {
        value: value,
        unit: fromUnit,
        originalValue: value,
        originalUnit: fromUnit,
      };
    }
  }, [value, fromUnit, unitType, locale, currentLocale, converter]);

  const formattedValue = useMemo(() => {
    return Number(converted.value.toFixed(precision));
  }, [converted.value, precision]);

  // Generate accessible label
  const accessibleLabel = useMemo(() => {
    if (ariaLabel) return ariaLabel;
    if (showOriginal && converted.originalUnit !== converted.unit) {
      return `${formattedValue} ${converted.unit} (${converted.originalValue} ${converted.originalUnit})`;
    }
    return `${formattedValue} ${converted.unit}`;
  }, [ariaLabel, formattedValue, converted, showOriginal]);

  return (
    <span
      className={cn('tabular-nums', className)}
      aria-label={accessibleLabel}
      role="text"
    >
      {formattedValue} {converted.unit}
      {showOriginal && converted.originalUnit !== converted.unit && (
        <span className="text-muted-foreground text-sm ml-2">
          ({converted.originalValue} {converted.originalUnit})
        </span>
      )}
    </span>
  );
}

