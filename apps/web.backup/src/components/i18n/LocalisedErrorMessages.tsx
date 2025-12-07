/**
 * B241C-I18N-025: LocalisedErrorMessages & Validation UI
 *
 * Shows form validation and error messages in the user's language;
 * integrates with i18n templating; supports plural forms; fallback to default language if missing
 */

'use client';

import { AlertCircle, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTranslation, Translation } from '@/i18n';
import { cn } from '@/lib/utils';

export interface ValidationError {
  field?: string;
  message: string;
  code?: string;
  params?: Record<string, string | number>;
}

interface LocalisedErrorMessagesProps {
  errors?: ValidationError | ValidationError[];
  className?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  variant?: 'default' | 'destructive';
}

export function LocalisedErrorMessages({
  errors,
  className,
  dismissible = false,
  onDismiss,
  variant = 'destructive',
}: LocalisedErrorMessagesProps) {
  const { t, locale } = useTranslation();

  if (!errors) return null;

  const errorArray = Array.isArray(errors) ? errors : [errors];
  if (errorArray.length === 0) return null;

  // Get localized error message
  const getLocalizedMessage = (error: ValidationError): string => {
    // Try to get translation by error code first
    if (error.code) {
      const translated = t(`errors.${error.code}`, error.params || {});
      if (translated && translated !== `errors.${error.code}`) {
        return translated;
      }
    }

    // Try to get translation by field and code
    if (error.field && error.code) {
      const translated = t(`validation.${error.field}.${error.code}`, error.params || {});
      if (translated && translated !== `validation.${error.field}.${error.code}`) {
        return translated;
      }
    }

    // Try generic validation message
    if (error.field) {
      const translated = t(`validation.${error.field}`, error.params || {});
      if (translated && translated !== `validation.${error.field}`) {
        return translated;
      }
    }

    // Fallback to provided message or default
    return error.message || t('common.error', 'An error occurred');
  };

  // Handle plural forms
  const formatPluralMessage = (message: string, count?: number): string => {
    if (count === undefined) return message;

    // Check if message contains plural forms (simple pattern matching)
    const pluralMatch = message.match(/(.*)\|(.*)/);
    if (pluralMatch) {
      const [, singular, plural] = pluralMatch;
      return count === 1 ? singular.trim() : plural.trim();
    }

    // Use i18n plural rules
    try {
      const rules = new Intl.PluralRules(locale);
      const form = rules.select(count);
      // This is a simplified implementation - in production, use proper i18n plural handling
      return message;
    } catch {
      return message;
    }
  };

  if (errorArray.length === 1) {
    const error = errorArray[0];
    const message = formatPluralMessage(getLocalizedMessage(error), error.params?.count as number);

    return (
      <Alert variant={variant || 'destructive'} className={cn('relative', className)}>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('common.error', 'Error')}</AlertTitle>
        <AlertDescription>
          {message}
        </AlertDescription>
        {dismissible && (
          <button
            onClick={onDismiss}
            className="absolute top-2 right-2 rounded-sm opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </Alert>
    );
  }

  return (
    <Alert variant={variant || 'destructive'} className={cn('relative', className)}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>
        {t('validation.multipleErrors', { count: errorArray.length }, `${errorArray.length} errors found`)}
      </AlertTitle>
      <AlertDescription>
        <ul className="list-disc list-inside space-y-1">
          {errorArray.map((error, index) => {
            const message = formatPluralMessage(getLocalizedMessage(error), error.params?.count as number);
            return (
              <li key={index}>
                {error.field && (
                  <span className="font-medium">{error.field}: </span>
                )}
                {message}
              </li>
            );
          })}
        </ul>
      </AlertDescription>
      {dismissible && (
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 rounded-sm opacity-70 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </Alert>
  );
}

/**
 * Hook for form validation with localized messages
 */
export function useLocalisedValidation() {
  const { t } = useTranslation();

  const validate = (rules: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    email?: boolean;
    custom?: (value: any) => string | null;
  }) => {
    return (value: any): ValidationError | null => {
      // Required validation
      if (rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        return {
          message: t('validation.required', 'This field is required'),
          code: 'required',
        };
      }

      if (!value) return null; // Skip other validations if value is empty

      // Email validation
      if (rules.email && typeof value === 'string') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return {
            message: t('validation.email', 'Please enter a valid email address'),
            code: 'email',
          };
        }
      }

      // Length validations
      if (typeof value === 'string') {
        if (rules.minLength && value.length < rules.minLength) {
          return {
            message: t('validation.minLength', { min: rules.minLength }, `Must be at least ${rules.minLength} characters`),
            code: 'minLength',
            params: { min: rules.minLength },
          };
        }

        if (rules.maxLength && value.length > rules.maxLength) {
          return {
            message: t('validation.maxLength', { max: rules.maxLength }, `Must be no more than ${rules.maxLength} characters`),
            code: 'maxLength',
            params: { max: rules.maxLength },
          };
        }
      }

      // Pattern validation
      if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
        return {
          message: t('validation.pattern', 'Invalid format'),
          code: 'pattern',
        };
      }

      // Custom validation
      if (rules.custom) {
        const customError = rules.custom(value);
        if (customError) {
          return {
            message: customError,
            code: 'custom',
          };
        }
      }

      return null;
    };
  };

  return { validate };
}

