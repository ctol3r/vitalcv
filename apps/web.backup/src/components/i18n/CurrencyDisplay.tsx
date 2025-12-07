/**
 * B252C-I18N-026: CurrencyDisplay Component
 *
 * Component to display currency values formatted according to user's locale;
 * takes amount and currencyCode; uses CurrencyFormatService; accessible with proper aria-labels
 */

'use client';

import { useMemo } from 'react';
import { useTranslation, formatCurrency } from '@/i18n';
import { cn } from '@/lib/utils';

interface CurrencyDisplayProps {
  amount: number;
  currencyCode: string;
  locale?: string;
  options?: Intl.NumberFormatOptions;
  className?: string;
  showSymbol?: boolean;
  'aria-label'?: string;
}

export function CurrencyDisplay({
  amount,
  currencyCode,
  locale,
  options,
  className,
  showSymbol = true,
  'aria-label': ariaLabel,
}: CurrencyDisplayProps) {
  const { locale: currentLocale } = useTranslation();

  const formattedCurrency = useMemo(() => {
    const targetLocale = (locale || currentLocale) as any;
    return formatCurrency(amount, currencyCode, options || {}, targetLocale);
  }, [amount, currencyCode, locale, currentLocale, options]);

  // Generate accessible label
  const accessibleLabel = useMemo(() => {
    if (ariaLabel) return ariaLabel;
    return `${formattedCurrency} ${currencyCode}`;
  }, [formattedCurrency, currencyCode, ariaLabel]);

  return (
    <span
      className={cn('tabular-nums', className)}
      aria-label={accessibleLabel}
      role="text"
    >
      {formattedCurrency}
    </span>
  );
}

