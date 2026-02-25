// apps/web/types/clerk.d.ts
//
// Augments Clerk's JWT session claims with VitalCV-specific metadata.
// Clerk publicMetadata is namespaced under "vitalcv" to avoid collisions
// with other integrations.
//
// CustomJwtSessionClaims is declared globally by @clerk/shared.

export interface VitalCVMetadata {
  role: 'CLINICIAN' | 'VERIFIER' | 'ISSUER' | 'ADMIN';
  roleVersion: number;
}

declare global {
  interface CustomJwtSessionClaims {
    vitalcv?: VitalCVMetadata;
  }
}
