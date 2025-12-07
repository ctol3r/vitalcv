/**
 * B252C-I18N-027: DateTimeDisplay Component
 *
 * Component to display date and time in user's locale and timezone;
 * accepts Date or ISO string; uses DateTimeFormatService; accessible text
 */

'use client';

import { useMemo } from 'react';
import { useTranslation, formatDate, formatTime, formatDateTime, formatRelativeTime } from '@/i18n';
import { cn } from '@/lib/utils';

type DateTimeDisplayMode = 'date' | 'time' | 'datetime' | 'relative';

interface DateTimeDisplayProps {
  value: Date | string | number;
  mode?: DateTimeDisplayMode;
  locale?: string;
  timeZone?: string;
  options?: Intl.DateTimeFormatOptions;
  className?: string;
  'aria-label'?: string;
}

export function DateTimeDisplay({
  value,
  mode = 'datetime',
  locale,
  timeZone,
  options,
  className,
  'aria-label': ariaLabel,
}: DateTimeDisplayProps) {
  const { locale: currentLocale } = useTranslation();

  const dateValue = useMemo(() => {
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value);
    }
    return new Date();
  }, [value]);

  const formattedValue = useMemo(() => {
    const targetLocale = (locale || currentLocale) as any;
    const formatOptions: Intl.DateTimeFormatOptions = {
      timeZone,
      ...options,
    };

    switch (mode) {
      case 'date':
        return formatDate(dateValue, formatOptions, targetLocale);
      case 'time':
        return formatTime(dateValue, formatOptions, targetLocale);
      case 'relative':
        return formatRelativeTime(dateValue, targetLocale);
      case 'datetime':
      default:
        return formatDateTime(dateValue, formatOptions, targetLocale);
    }
  }, [dateValue, mode, locale, currentLocale, timeZone, options]);

  // Generate accessible label
  const accessibleLabel = useMemo(() => {
    if (ariaLabel) return ariaLabel;
    const dateStr = dateValue.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone,
    });
    return `${mode} ${dateStr}`;
  }, [ariaLabel, mode, dateValue, timeZone]);

  return (
    <time
      dateTime={dateValue.toISOString()}
      className={cn(className)}
      aria-label={accessibleLabel}
    >
      {formattedValue}
    </time>
  );
}

