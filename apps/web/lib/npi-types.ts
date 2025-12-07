/**
 * NPI-related types and interfaces
 */

export type NpiType = 1 | 2;

export type ClaimLevel = 0 | 1 | 2 | 3;

export type UserRole = 'holder' | 'issuer' | 'verifier';

export interface NpiRecord {
  npi: string;
  type: NpiType;
  name: string;
  firstName?: string;
  lastName?: string;
  organizationName?: string;
  taxonomyCode: string;
  taxonomyDescription: string;
  addresses: NpiAddress[];
  isOrganization: boolean;
  lastUpdated?: string;
}

export interface NpiAddress {
  addressType: 'LOCATION' | 'MAILING';
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  telephoneNumber?: string;
  faxNumber?: string;
}

export interface ClaimStatus {
  npi: string;
  level: ClaimLevel;
  email?: string;
  phone?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  documentsUploaded: boolean;
  selfieUploaded: boolean;
  identityConfidence?: number; // 0-100
  issuerAttestation?: {
    issuerId: string;
    issuerName: string;
    attestedAt: string;
    onChainHash?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ClaimRequest {
  npi: string;
  email?: string;
  phone?: string;
  pin?: string;
}

export interface UserSession {
  userId: string;
  email: string;
  roles: UserRole[];
  claimLevel: ClaimLevel;
  npi?: string;
  selectedRole?: UserRole;
}

export interface TelemetryEvent {
  event: 'npi_lookup' | 'claim_start' | 'claim_level1_ok' | 'claim_level2_ok' | 'attest_requested';
  timestamp: string;
  duration?: number;
  metadata?: Record<string, any>;
}

