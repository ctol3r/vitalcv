-- Wave 180 — Identity Workspace Graph
-- Dry-run migration plan only.
-- Do not execute via prisma migrate in this wave.

BEGIN;

CREATE TYPE "NpiType" AS ENUM ('TYPE_1', 'TYPE_2');
CREATE TYPE "ActivePersona" AS ENUM ('CLINICIAN', 'VERIFIER', 'BOTH');
CREATE TYPE "MembershipRole" AS ENUM (
  'HOLDER',
  'VERIFIER',
  'ISSUER',
  'ADMIN',
  'RECRUITER',
  'CREDENTIALING_SPECIALIST'
);

CREATE TABLE person_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES "User"(id) ON DELETE CASCADE,
  npi TEXT UNIQUE,
  npi_type "NpiType" DEFAULT 'TYPE_1',
  first_name TEXT,
  last_name TEXT,
  specialty TEXT,
  state_of_practice TEXT,
  work_auth_status TEXT,
  resume_url TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT,
  completeness INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX person_profiles_npi_idx ON person_profiles (npi);
CREATE INDEX person_profiles_user_id_idx ON person_profiles (user_id);

CREATE TABLE organization_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES "Organization"(id) ON DELETE CASCADE,
  npi TEXT,
  npi_type "NpiType" DEFAULT 'TYPE_2',
  org_did TEXT,
  facility_type TEXT,
  specialties TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  states_covered TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX organization_profiles_npi_idx ON organization_profiles (npi);
CREATE INDEX organization_profiles_organization_id_idx ON organization_profiles (organization_id);

CREATE TABLE workspace_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_profile_id UUID NOT NULL REFERENCES person_profiles(id) ON DELETE CASCADE,
  organization_profile_id UUID NOT NULL REFERENCES organization_profiles(id) ON DELETE CASCADE,
  role "MembershipRole" NOT NULL DEFAULT 'VERIFIER',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workspace_memberships_person_org_key UNIQUE (person_profile_id, organization_profile_id)
);

CREATE INDEX workspace_memberships_person_profile_id_idx ON workspace_memberships (person_profile_id);
CREATE INDEX workspace_memberships_organization_profile_id_idx ON workspace_memberships (organization_profile_id);

CREATE TABLE workspace_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES "User"(id) ON DELETE CASCADE,
  active_persona "ActivePersona" NOT NULL DEFAULT 'CLINICIAN',
  active_org_id UUID REFERENCES "Organization"(id) ON DELETE SET NULL,
  sidebar_collapsed BOOLEAN NOT NULL DEFAULT FALSE,
  last_switched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX workspace_preferences_user_id_idx ON workspace_preferences (user_id);
CREATE INDEX workspace_preferences_active_org_id_idx ON workspace_preferences (active_org_id);

COMMIT;
