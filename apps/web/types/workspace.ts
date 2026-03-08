export type ActivePersona = 'CLINICIAN' | 'VERIFIER' | 'BOTH';

export type MembershipRole =
  | 'HOLDER'
  | 'VERIFIER'
  | 'ISSUER'
  | 'ADMIN'
  | 'RECRUITER'
  | 'CREDENTIALING_SPECIALIST';

export interface WorkspaceOrganizationProfile {
  id: string;
  organizationId: string;
  npi: string | null;
  npiType: 'TYPE_1' | 'TYPE_2' | null;
  orgDid: string | null;
  facilityType: string | null;
  specialties: string[];
  statesCovered: string[];
  website: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspacePersonProfile {
  id: string;
  userId: string;
  npi: string | null;
  npiType: 'TYPE_1' | 'TYPE_2' | null;
  firstName: string | null;
  lastName: string | null;
  specialty: string | null;
  stateOfPractice: string | null;
  workAuthStatus: string | null;
  resumeUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  completeness: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspacePreference {
  id: string;
  userId: string;
  activePersona: ActivePersona;
  activeOrgId: string | null;
  sidebarCollapsed: boolean;
  lastSwitchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceList {
  userId: string;
  activePersona: ActivePersona;
  personProfile: WorkspacePersonProfile | null;
  memberships: Array<{
    org: WorkspaceOrganizationProfile;
    role: MembershipRole;
    active: boolean;
  }>;
  canSwitchTo: ActivePersona[];
}
