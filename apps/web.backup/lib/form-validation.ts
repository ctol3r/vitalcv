/**
 * Form Validation Utilities
 * Reusable validation functions with consistent error messages
 */

import { z } from 'zod';

// Common validation schemas
export const npiSchema = z
  .string()
  .length(10, 'NPI must be exactly 10 digits')
  .regex(/^\d+$/, 'NPI must contain only numbers')
  .refine((npi) => {
    // Luhn algorithm validation
    const payload = '80840' + npi.slice(0, 9);
    let sum = 0;
    for (let i = 0; i < payload.length; i++) {
      let d = parseInt(payload[payload.length - 1 - i], 10);
      if (i % 2 === 0) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
    }
    const check = (10 - (sum % 10)) % 10;
    return check === parseInt(npi[9], 10);
  }, 'Invalid NPI checksum');

export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email address');

export const didSchema = z
  .string()
  .min(1, 'DID is required')
  .regex(/^did:[a-z0-9]+:[a-zA-Z0-9._%-]*$/, 'Invalid DID format');

export const credentialIdSchema = z
  .string()
  .min(1, 'Credential ID is required')
  .max(100, 'Credential ID too long');

// Form schemas
export const npiLookupFormSchema = z.object({
  npi: npiSchema,
});

export const credentialShareFormSchema = z.object({
  credentialId: credentialIdSchema,
  selectedFields: z.array(z.string()).min(1, 'Select at least one field to share'),
  verifierDid: didSchema.optional(),
});

export const issueCredentialFormSchema = z.object({
  subjectId: z.string().min(1, 'Subject ID is required'),
  type: z.string().min(1, 'Credential type is required'),
  claims: z.record(z.any()).refine(
    (claims) => Object.keys(claims).length > 0,
    'At least one claim is required'
  ),
  expiresAt: z.string().optional(),
});

export const verifyCredentialFormSchema = z.object({
  credentialId: credentialIdSchema,
  nonce: z.string().optional(),
  audience: z.string().optional(),
  privacyMode: z.enum(['plain', 'bbs', 'zk']).default('plain'),
});

// Validation helpers
export function validateNPI(npi: string): { valid: boolean; error?: string } {
  try {
    npiSchema.parse(npi);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors[0]?.message };
    }
    return { valid: false, error: 'Invalid NPI' };
  }
}

export function validateEmail(email: string): { valid: boolean; error?: string } {
  try {
    emailSchema.parse(email);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors[0]?.message };
    }
    return { valid: false, error: 'Invalid email' };
  }
}

export function validateDID(did: string): { valid: boolean; error?: string } {
  try {
    didSchema.parse(did);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors[0]?.message };
    }
    return { valid: false, error: 'Invalid DID' };
  }
}

// Real-time validation hook
export function useFieldValidation<T extends z.ZodType>(
  schema: T,
  debounceMs = 300
): {
  validate: (value: string) => void;
  error: string | null;
  isValidating: boolean;
} {
  const [error, setError] = React.useState<string | null>(null);
  const [isValidating, setIsValidating] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout>();

  const validate = React.useCallback(
    (value: string) => {
      setIsValidating(true);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        try {
          schema.parse(value);
          setError(null);
        } catch (err) {
          if (err instanceof z.ZodError) {
            setError(err.errors[0]?.message || 'Validation error');
          }
        } finally {
          setIsValidating(false);
        }
      }, debounceMs);
    },
    [schema, debounceMs]
  );

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { validate, error, isValidating };
}

// Form error formatter
export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  return errors;
}

// Client-side validation wrapper
export async function safeValidate<T>(
  schema: z.ZodType<T>,
  data: unknown
): Promise<{ success: true; data: T } | { success: false; errors: Record<string, string> }> {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: formatZodErrors(error) };
    }
    return { success: false, errors: { _form: 'Validation failed' } };
  }
}

import React from 'react';

