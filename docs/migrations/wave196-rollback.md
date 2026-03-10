# Wave 196 Rollback Notes

## Migration: `20260310000000_wave196_production_hardening`

### What Was Added

Tables for Juggernaut waves 180–195 that lacked explicit migrations:

| Table | Model | Wave |
|---|---|---|
| `person_profiles` | PersonProfile | 180 |
| `organization_profiles` | OrganizationProfile | 180 |
| `workspace_memberships` | WorkspaceMembership | 180 |
| `workspace_preferences` | WorkspacePreference | 180 |
| `DecisionCapsule` | DecisionCapsule | Chain A |
| `SearchObject` | SearchObject | 184 |
| `SearchObjectACL` | SearchObjectACL | 184 |
| `SearchIndexRun` | SearchIndexRun | 184 |

Enums added (idempotent, skip if exists):
- `NpiType`, `ActivePersona`, `MembershipRole`, `EmployerHiringStatus`, `SearchObjectType`, `SearchAclLevel`

### SQL Rollback

```sql
-- Run in order (reverse FK dependency)
DROP TABLE IF EXISTS "SearchObjectACL";
DROP TABLE IF EXISTS "SearchIndexRun";
DROP TABLE IF EXISTS "SearchObject";
DROP TABLE IF EXISTS "DecisionCapsule";
DROP TABLE IF EXISTS "workspace_preferences";
DROP TABLE IF EXISTS "workspace_memberships";
DROP TABLE IF EXISTS "organization_profiles";
DROP TABLE IF EXISTS "person_profiles";

-- Drop enums only if no other tables use them
-- DROP TYPE IF EXISTS "SearchAclLevel";
-- DROP TYPE IF EXISTS "SearchObjectType";
-- DROP TYPE IF EXISTS "MembershipRole";
-- DROP TYPE IF EXISTS "ActivePersona";
-- DROP TYPE IF EXISTS "EmployerHiringStatus";
-- DROP TYPE IF EXISTS "NpiType";
```

### Service Dependencies

| Service | Depends On |
|---|---|
| apps/api/backend/src/services/workspace/ | workspace_memberships, workspace_preferences |
| apps/api/backend/src/services/employers/employerService.ts | organization_profiles |
| apps/api/backend/src/services/search/searchIndex.ts | SearchObject, SearchObjectACL, SearchIndexRun |
| apps/api/backend/src/services/decision/capsuleEngine.ts | DecisionCapsule |

### Checkpoint

Committed on branch: `wave/196-production-hardening`
Base commit: `6de71566` (main, post-wave-195)
