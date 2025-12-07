/**
 * EUDI Trust Models - eIDAS2 / TS119612 v2.4.1
 * Batch 54: Trust-service provider & issuer profile types
 */

export type TrustServiceProvider = {
  id: string;
  name: string;
  type: 'qualified' | 'non-qualified';
  accreditation?: string;
  standard_refs?: string[];
  certificate_url?: string;
  template_version?: string;
  risk_policy_url?: string;
  last_checked?: string;
};

export type IssuerProfile = {
  profile_id: string;
  vc_type: string;
  trust_service_id?: string;
  disclosure: 'sd-jwt' | 'bbs';
  min_assurance?: string;
};

