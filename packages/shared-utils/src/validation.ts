/**
 * Common validation schemas using Zod
 */

import { z } from 'zod';

/**
 * NPI validation schema
 */
export const npiSchema = z.string()
  .regex(/^\d{10}$/, 'NPI must be exactly 10 digits')
  .refine((npi) => {
    // Basic Luhn check (simplified)
    const digits = npi.split('').map(Number);
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += digits[i];
    }
    return (sum + digits[9]) % 10 === 0;
  }, 'Invalid NPI checksum');

/**
 * Email validation schema
 */
export const emailSchema = z.string().email('Invalid email address');

/**
 * Phone number validation schema (US format)
 */
export const phoneSchema = z.string()
  .regex(/^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/, 'Invalid phone number format');

