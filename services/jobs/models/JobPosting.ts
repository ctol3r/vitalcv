/**
 * B132A-JOBS-004: Job Posting model with FHIR HealthcareService alignment
 *
 * Model for healthcare job postings with specialty, location, modality, and telehealth support.
 * Aligned with FHIR HealthcareService resource for interoperability.
 */

import { z } from 'zod';

// Location schema
export const LocationSchema = z.object({
  city: z.string().optional(),
  state: z.string().length(2), // Two-letter state code
  zip: z.string().optional(),
  coords: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
});

export type Location = z.infer<typeof LocationSchema>;

// Job Posting validation schema
// B138A-JOBS-010: Enhanced with compact support
export const JobPostingSchema = z.object({
  partnerId: z.string(),
  externalJobId: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  specialty: z.string().min(1, 'Specialty is required'), // Healthcare taxonomy code
  requiredStates: z.array(z.string().length(2)).min(1, 'At least one state required'),
  targetLicenseJurisdictions: z.array(z.string().length(2)).default([]), // B138A-JOBS-010
  modality: z.enum(['in-person', 'telehealth', 'hybrid']).default('in-person'),
  location: LocationSchema.optional(),
  compRangeMin: z.number().int().positive().optional(),
  compRangeMax: z.number().int().positive().optional(),
  compCurrency: z.string().default('USD'),
  telehealth: z.boolean().default(false),
  imlcEligible: z.boolean().default(false),
  imlcAllowed: z.boolean().default(false), // B138A-JOBS-010
  psypactAllowed: z.boolean().default(false), // B138A-JOBS-010
  counselingCompactAllowed: z.boolean().default(false), // B138A-JOBS-010
  multiStateOk: z.boolean().default(false),
  compactAllowed: z.boolean().default(false), // B138A-JOBS-010: General flag for any compact
  fhirMetadata: z.record(z.any()).optional(),
  status: z.enum(['active', 'closed', 'filled']).default('active'),
});

export type JobPostingCreate = z.infer<typeof JobPostingSchema>;

// FHIR HealthcareService mapping helpers
export function toFhirHealthcareService(job: any) {
  return {
    resourceType: 'HealthcareService',
    id: job.id,
    active: job.status === 'active',
    name: job.title,
    comment: job.description,
    specialty: [
      {
        coding: [
          {
            system: 'http://nucc.org/provider-taxonomy',
            code: job.specialty,
          },
        ],
      },
    ],
    location: job.location ? [
      {
        reference: `Location/${job.id}`,
        display: `${job.location.city}, ${job.location.state}`,
      },
    ] : undefined,
    telecom: job.telehealth ? [
      {
        system: 'url',
        value: 'telehealth',
      },
    ] : undefined,
    ...job.fhirMetadata,
  };
}

export function validateJobPosting(data: unknown): JobPostingCreate {
  return JobPostingSchema.parse(data);
}

// Job matching criteria
export interface JobMatchCriteria {
  specialty: string;
  licenseStates: string[];
  imlcMember?: boolean;
  multiStateLicenses?: string[];
  preferredModality?: 'in-person' | 'telehealth' | 'hybrid';
  location?: {
    state: string;
    maxDistance?: number; // miles
  };
}

