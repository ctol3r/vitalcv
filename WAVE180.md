# Wave 180 — Dual-Entity Identity & Workspace Graph

## Context
VitalCV is a healthcare credentialing trust network. You are working in the monorepo at ~/vitalcv.
- Frontend: apps/web (Next.js 15, React 19, Tailwind v4, TypeScript)
- Backend: apps/api/backend (Express, Prisma ORM, TypeScript)
- Prisma schema: apps/api/backend/prisma/schema.prisma
- Route pattern: `export function registerXxxRoutes(app: Express): void`
- Build: `pnpm --filter @vitalcv/api build` + `pnpm --filter web build`
- Token system: use vt-* CSS tokens (bg-vt-surface-ops-base etc)
- Auth: Clerk (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY env)

## Objective
Add dual-entity identity and workspace graph. One user can be a clinician, a verifier org member, or both. The workspace system enables switching between personas without re-logging in.

## CRITICAL RULES
- DO NOT run `prisma migrate` — add models and run `prisma generate` only
- Write the migration SQL plan to docs/migrations/wave180-identity-workspace.sql instead
- DO NOT delete any existing models or routes
- Maintain existing UserRole enum values (CLINICIAN, VERIFIER, ISSUER, ADMIN)
- Build must pass: `pnpm --filter @vitalcv/api build` AND `pnpm --filter web build`
- Lint must pass: `pnpm --filter web lint`
- TypeScript must pass: `cd apps/web && pnpm tsc --noEmit`
- Branch: already on wave/180-identity-workspace-graph

## Task 1: Prisma Schema Additions

File: apps/api/backend/prisma/schema.prisma

Add AFTER the existing Organization model:

```prisma
/// NPI classification
enum NpiType {
  TYPE_1 // Individual clinician
  TYPE_2 // Organization / group practice
}

/// Workspace persona a user is currently operating as
enum ActivePersona {
  CLINICIAN
  VERIFIER
  BOTH
}

/// Membership role within an organization workspace
enum MembershipRole {
  HOLDER
  VERIFIER
  ISSUER
  ADMIN
  RECRUITER
  CREDENTIALING_SPECIALIST
}

/// Linked profile for an individual clinician (Type 1 NPI)
model PersonProfile {
  id              String   @id @default(uuid()) @db.Uuid
  userId          String   @unique @db.Uuid
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  npi             String?  @unique
  npiType         NpiType? @default(TYPE_1)
  firstName       String?
  lastName        String?
  specialty       String?
  stateOfPractice String?
  workAuthStatus  String?  // authorized | pending | not_provided
  resumeUrl       String?
  linkedinUrl     String?
  portfolioUrl    String?
  completeness    Int      @default(0)  // 0–100 profile completeness score
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  memberships     WorkspaceMembership[]

  @@index([npi])
  @@index([userId])
}

/// Linked profile for an organization (Type 2 NPI or Org DID)
model OrganizationProfile {
  id            String   @id @default(uuid()) @db.Uuid
  organizationId String  @unique @db.Uuid
  organization  Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  npi           String?  // Type 2 NPI
  npiType       NpiType? @default(TYPE_2)
  orgDid        String?  // did:vitalcv:org:...
  facilityType  String?  // hospital | clinic | telehealth | staffing | other
  specialties   String[] // accepted specialties
  statesCovered String[] // states they operate in
  website       String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  memberships   WorkspaceMembership[]

  @@index([npi])
  @@index([organizationId])
}

/// Links a person to an organization with a role
model WorkspaceMembership {
  id                   String             @id @default(uuid()) @db.Uuid
  personProfileId      String             @db.Uuid
  personProfile        PersonProfile      @relation(fields: [personProfileId], references: [id], onDelete: Cascade)
  organizationProfileId String            @db.Uuid
  organizationProfile  OrganizationProfile @relation(fields: [organizationProfileId], references: [id], onDelete: Cascade)
  role                 MembershipRole     @default(VERIFIER)
  active               Boolean            @default(true)
  invitedAt            DateTime?
  acceptedAt           DateTime?
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt

  @@unique([personProfileId, organizationProfileId])
  @@index([personProfileId])
  @@index([organizationProfileId])
}

/// Per-user workspace preferences and active persona state
model WorkspacePreference {
  id              String        @id @default(uuid()) @db.Uuid
  userId          String        @unique @db.Uuid
  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  activePersona   ActivePersona @default(CLINICIAN)
  activeOrgId     String?       @db.Uuid // last active org workspace
  sidebarCollapsed Boolean      @default(false)
  lastSwitchedAt  DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([userId])
}
```

Also add the following relations to the EXISTING User model (find it and add the fields):
- `personProfile     PersonProfile?`
- `workspacePreference WorkspacePreference?`

Also add to the EXISTING Organization model:
- `organizationProfile OrganizationProfile?`

Run after schema changes:
```bash
cd apps/api/backend && npx prisma generate
```

## Task 2: Migration Plan

Create file: docs/migrations/wave180-identity-workspace.sql

Write SQL CREATE TABLE statements for:
- person_profiles
- organization_profiles  
- workspace_memberships
- workspace_preferences

With proper FK references and indexes. Mark it as a dry-run plan (not executed).

## Task 3: Backend Service

Create: apps/api/backend/src/services/workspace/workspaceService.ts

Implement:
```typescript
export async function getWorkspacesForUser(clerkUserId: string): Promise<WorkspaceList>
export async function switchWorkspace(clerkUserId: string, targetPersona: ActivePersona, orgId?: string): Promise<WorkspacePreference>
export async function bootstrapFromNpi(npi: string): Promise<NpiBootstrapResult>
export async function createPersonProfile(userId: string, data: Partial<PersonProfileInput>): Promise<PersonProfile>
export async function ensureWorkspacePreference(userId: string): Promise<WorkspacePreference>
```

WorkspaceList type:
```typescript
interface WorkspaceList {
  userId: string;
  activePersona: ActivePersona;
  personProfile: PersonProfile | null;
  memberships: Array<{
    org: OrganizationProfile;
    role: MembershipRole;
    active: boolean;
  }>;
  canSwitchTo: ActivePersona[];
}
```

NpiBootstrapResult:
```typescript
interface NpiBootstrapResult {
  npi: string;
  npiType: 'TYPE_1' | 'TYPE_2';
  inferredPersona: 'CLINICIAN' | 'VERIFIER' | 'UNKNOWN';
  firstName?: string;
  lastName?: string;
  specialty?: string;
  state?: string;
  alreadyRegistered: boolean;
}
```

bootstrapFromNpi should call the existing NPPES lookup if available, or return a structured stub if not.

## Task 4: Backend Routes

Create: apps/api/backend/src/routes/workspace.ts

Register function: `export function registerWorkspaceRoutes(app: Express): void`

Routes:
- GET /api/me/workspaces — returns WorkspaceList for authenticated user (use req.headers['x-clerk-user-id'] or similar)
- POST /api/workspaces/switch — body: { persona: ActivePersona, orgId?: string } → switches active persona, emits audit event
- GET /api/identity/bootstrap/:npi — validates NPI format, calls bootstrapFromNpi

For auth middleware: check for x-clerk-user-id header or use existing auth pattern in the codebase (look at other routes for the pattern).

Wire the route in apps/api/backend/src/index.ts (find where other routes are registered and add registerWorkspaceRoutes).

## Task 5: Audit Events

In workspaceService.ts, emit audit events for:
- workspace_created (when PersonProfile created)
- workspace_switched (on every switch)

Use the existing AuditEvent model via Prisma. Look at apps/api/backend/src/services/audit/ for patterns.

## Task 6: Analytics

Create: apps/api/backend/src/services/workspace/workspaceAnalytics.ts

```typescript
export async function getDualRoleUserRate(): Promise<{ total: number; dualRole: number; rate: number }>
export async function getWorkspaceSwitchCount(since: Date): Promise<number>
```

## Task 7: Frontend — WorkspaceSwitcher Component

Create: apps/web/components/workspace/WorkspaceSwitcher.tsx

A client component that:
- Fetches GET /api/me/workspaces
- Shows active persona badge: "Clinician" | "Employer" | "Both"
- Has a dropdown to switch persona (calls POST /api/workspaces/switch)
- Uses vt-* design tokens (bg-vt-surface-ops-raised, text-vt-neutral-100 etc)
- Uses heading-sm, body-sm typography classes
- Accessible: proper aria-label, role="menu"
- Shows in authenticated shell (add to apps/web/app/layout.tsx conditionally)

## Task 8: Frontend — Workspace Switch Route

Create: apps/web/app/workspace/switch/page.tsx

A simple page that:
- Shows 3 cards: "I'm a Clinician", "I'm an Employer / Verifier", "I'm Both"
- Each card calls POST /api/workspaces/switch and redirects to appropriate home
- Route: /workspace/switch
- Uses vt-* tokens and heading-lg/body typography

## Task 9: API Types

Create: apps/web/types/workspace.ts

Export TypeScript types for frontend use:
- WorkspaceList
- WorkspacePreference
- ActivePersona
- MembershipRole

## Verification

After implementing all tasks, run:
```bash
cd ~/vitalcv && pnpm --filter @vitalcv/api build
cd ~/vitalcv && pnpm --filter web build
cd ~/vitalcv/apps/web && pnpm tsc --noEmit
cd ~/vitalcv && pnpm lint
```

If ANY of these fail, fix the errors before finishing.

## Git

Commit with: `feat(wave180): Dual-Entity Identity & Workspace Graph`

Do NOT push. Leave on branch wave/180-identity-workspace-graph.

When completely finished, run:
openclaw system event --text "Wave 180 complete: Identity & Workspace Graph built" --mode now
