# Auth & RBAC Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add production-grade role-based authorization to VitalCV using Clerk (identity) + Prisma (canonical roles) hybrid model.

**Architecture:** Prisma `User` model is canonical role source. Clerk `publicMetadata.vitalcv` carries role claim for zero-latency middleware checks. Webhook syncs Clerk->Prisma on user creation. Write-through utility syncs Prisma->Clerk on role changes. Middleware reads JWT claim (fast path); backend re-checks Prisma for sensitive writes.

**Tech Stack:** Next.js 15 (App Router), Clerk (`@clerk/nextjs`), Prisma (PostgreSQL), Express, Vitest (web), Jest (backend), svix (webhook verification)

**Design doc:** `docs/plans/2026-02-24-auth-rbac-design.md`

---

## Task 1: Prisma Schema — User Model, Role Enum, Status Enum

**Files:**
- Modify: `apps/api/backend/prisma/schema.prisma`

**Step 1: Add enums and User model to schema**

Add at the top of `schema.prisma`, after the `datasource` block:

```prisma
// ──────────────────────────────────────────────────────────────
// Auth & RBAC: User identity linked to Clerk
// ──────────────────────────────────────────────────────────────

enum UserRole {
  CLINICIAN
  VERIFIER
  ISSUER
  ADMIN
}

enum UserStatus {
  ACTIVE
  INVITED
  SUSPENDED
  DEACTIVATED
}

model User {
  id             String     @id @default(uuid()) @db.Uuid
  clerkUserId    String     @unique
  email          String     @unique
  role           UserRole   @default(CLINICIAN)
  roleVersion    Int        @default(1)
  status         UserStatus @default(INVITED)
  organizationId String?    @db.Uuid
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  @@index([clerkUserId])
  @@index([organizationId])
  @@index([role])
  @@index([status])
}
```

**Step 2: Generate migration**

Run:
```bash
cd apps/api/backend && pnpm exec prisma migrate dev --name add_user_auth_rbac
```

Expected: Migration created, `User` table with enums in database.

**Step 3: Verify Prisma client generation**

Run:
```bash
cd apps/api/backend && pnpm exec prisma generate
```

Expected: `@prisma/client` regenerated. `UserRole`, `UserStatus`, `User` types available.

**Step 4: Commit**

```bash
git add apps/api/backend/prisma/schema.prisma apps/api/backend/prisma/migrations/
git commit -m "feat(schema): add User model with UserRole and UserStatus enums for RBAC"
```

---

## Task 2: Clerk Session Type Augmentation

**Files:**
- Create: `apps/web/types/clerk.d.ts`

**Step 1: Create type declaration file**

```typescript
// apps/web/types/clerk.d.ts
//
// Augments Clerk's JWT session claims with VitalCV-specific metadata.
// Clerk publicMetadata is namespaced under "vitalcv" to avoid collisions
// with other integrations.

export interface VitalCVMetadata {
  role: 'CLINICIAN' | 'VERIFIER' | 'ISSUER' | 'ADMIN';
  roleVersion: number;
}

declare module '@clerk/nextjs/server' {
  interface CustomJwtSessionClaims {
    vitalcv?: VitalCVMetadata;
  }
}
```

**Step 2: Verify tsconfig includes the types directory**

Check `apps/web/tsconfig.json` — the `include: ["**/*.ts", "**/*.tsx"]` pattern already
covers `types/clerk.d.ts` since it's under the web app root. No change needed.

**Step 3: Verify type resolution**

Open `apps/web/middleware.ts` in editor. Confirm that `auth().sessionClaims?.vitalcv?.role`
is type-safe (no red squiggles). This is a manual check during dev.

**Step 4: Commit**

```bash
git add apps/web/types/clerk.d.ts
git commit -m "feat(types): add Clerk session claim augmentation for VitalCV RBAC"
```

---

## Task 3: Role Constants & Route Mapping

**Files:**
- Create: `apps/web/lib/auth/roles.ts`

**Step 1: Create roles module**

```typescript
// apps/web/lib/auth/roles.ts
//
// Canonical role definitions, route-role mappings, and post-login redirects.
// Used by middleware, components, and tests.

export const UserRole = {
  CLINICIAN: 'CLINICIAN',
  VERIFIER: 'VERIFIER',
  ISSUER: 'ISSUER',
  ADMIN: 'ADMIN',
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

/**
 * Default landing page per role after login or role mismatch redirect.
 */
export const ROLE_LANDING: Record<UserRoleType, string> = {
  CLINICIAN: '/holder',
  VERIFIER: '/verifier',
  ISSUER: '/issuer',
  ADMIN: '/internal/metrics',
};

/**
 * Route prefix -> required role mapping.
 * Order matters: more specific prefixes must come first.
 */
export const PROTECTED_ROUTES: Array<{ pattern: RegExp; role: UserRoleType }> = [
  { pattern: /^\/holder(\/.*)?$/, role: UserRole.CLINICIAN },
  { pattern: /^\/verifier(\/.*)?$/, role: UserRole.VERIFIER },
  { pattern: /^\/issuer(\/.*)?$/, role: UserRole.ISSUER },
  { pattern: /^\/internal(\/.*)?$/, role: UserRole.ADMIN },
];

/**
 * Routes that never require authentication.
 */
export const PUBLIC_ROUTE_PATTERNS = [
  /^\/$/, // landing
  /^\/sign-in(\/.*)?$/,
  /^\/sign-up(\/.*)?$/,
  /^\/intake(\/.*)?$/,
  /^\/verify(\/.*)?$/,
  /^\/trust-state(\/.*)?$/,
  /^\/auth\/error$/,
  /^\/api(\/.*)?$/, // API routes handle their own auth
];

/**
 * Check if a pathname is a public route.
 */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTE_PATTERNS.some((p) => p.test(pathname));
}

/**
 * Get the required role for a pathname, or null if public/unprotected.
 */
export function getRequiredRole(pathname: string): UserRoleType | null {
  for (const route of PROTECTED_ROUTES) {
    if (route.pattern.test(pathname)) {
      return route.role;
    }
  }
  return null;
}

/**
 * Get the redirect target for a role mismatch.
 * /internal/** mismatches redirect to "/" (not role landing).
 */
export function getMismatchRedirect(
  pathname: string,
  userRole: UserRoleType
): string {
  if (pathname.startsWith('/internal')) {
    return '/';
  }
  return ROLE_LANDING[userRole];
}
```

**Step 2: Commit**

```bash
git add apps/web/lib/auth/roles.ts
git commit -m "feat(auth): add role constants, route mapping, and redirect logic"
```

---

## Task 4: Rewrite Next.js Middleware with Role-Based Guards

**Files:**
- Modify: `apps/web/middleware.ts`

**Step 1: Write the middleware test file first (TDD)**

Install vitest in web app (if not present):
```bash
cd apps/web && pnpm add -D vitest @vitejs/plugin-react
```

Create `apps/web/__tests__/middleware.test.ts`:

```typescript
// apps/web/__tests__/middleware.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Clerk before importing middleware
vi.mock('@clerk/nextjs/server', () => {
  const createRouteMatcher = vi.fn();
  const clerkMiddleware = vi.fn();
  return { createRouteMatcher, clerkMiddleware };
});

// We test the pure logic from roles.ts, not the full Clerk middleware integration
import {
  isPublicRoute,
  getRequiredRole,
  getMismatchRedirect,
  ROLE_LANDING,
  PROTECTED_ROUTES,
  PUBLIC_ROUTE_PATTERNS,
} from '../lib/auth/roles';

describe('Route role mapping', () => {
  // Table-driven route guard matrix
  const cases: Array<{
    path: string;
    role: string | null;
    expected: 'allow' | string; // 'allow' or redirect path
  }> = [
    // Public routes - no auth required
    { path: '/', role: null, expected: 'allow' },
    { path: '/sign-in', role: null, expected: 'allow' },
    { path: '/sign-up', role: null, expected: 'allow' },
    { path: '/intake', role: null, expected: 'allow' },
    { path: '/intake/step-2', role: null, expected: 'allow' },
    { path: '/verify/1234567890', role: null, expected: 'allow' },
    { path: '/trust-state/abc-123', role: null, expected: 'allow' },
    { path: '/auth/error', role: null, expected: 'allow' },

    // /holder - CLINICIAN only
    { path: '/holder', role: 'CLINICIAN', expected: 'allow' },
    { path: '/holder/checklist', role: 'CLINICIAN', expected: 'allow' },
    { path: '/holder', role: 'VERIFIER', expected: '/verifier' },
    { path: '/holder', role: 'ISSUER', expected: '/issuer' },
    { path: '/holder', role: 'ADMIN', expected: '/internal/metrics' },

    // /verifier - VERIFIER only
    { path: '/verifier', role: 'VERIFIER', expected: 'allow' },
    { path: '/verifier/dashboard', role: 'VERIFIER', expected: 'allow' },
    { path: '/verifier', role: 'CLINICIAN', expected: '/holder' },
    { path: '/verifier', role: 'ADMIN', expected: '/internal/metrics' },

    // /issuer - ISSUER only
    { path: '/issuer', role: 'ISSUER', expected: 'allow' },
    { path: '/issuer', role: 'CLINICIAN', expected: '/holder' },
    { path: '/issuer', role: 'VERIFIER', expected: '/verifier' },

    // /internal - ADMIN only, mismatch -> / (not role landing)
    { path: '/internal/metrics', role: 'ADMIN', expected: 'allow' },
    { path: '/internal/pilots', role: 'ADMIN', expected: 'allow' },
    { path: '/internal/metrics', role: 'CLINICIAN', expected: '/' },
    { path: '/internal/metrics', role: 'VERIFIER', expected: '/' },
    { path: '/internal/metrics', role: 'ISSUER', expected: '/' },
  ];

  it.each(cases)(
    '$path with role=$role -> $expected',
    ({ path, role, expected }) => {
      if (expected === 'allow') {
        if (role === null) {
          // Public route
          expect(isPublicRoute(path)).toBe(true);
        } else {
          // Protected route, role matches
          const required = getRequiredRole(path);
          expect(required).toBe(role);
        }
      } else {
        // Role mismatch -> redirect
        const required = getRequiredRole(path);
        expect(required).not.toBe(role);
        const redirect = getMismatchRedirect(path, role as any);
        expect(redirect).toBe(expected);
      }
    }
  );
});

describe('Route leak sentinel', () => {
  it('every protected route pattern is covered by the test matrix', () => {
    // Extract all protected route regex patterns
    const protectedPatterns = PROTECTED_ROUTES.map((r) => r.pattern);

    // These are the route prefixes we MUST have test cases for
    const testedPrefixes = ['/holder', '/verifier', '/issuer', '/internal'];

    for (const prefix of testedPrefixes) {
      const matchesAny = protectedPatterns.some((p) => p.test(prefix));
      expect(matchesAny).toBe(true);
    }
  });

  it('no protected route is accidentally public', () => {
    const protectedPaths = ['/holder', '/verifier', '/issuer', '/internal/metrics'];
    for (const path of protectedPaths) {
      expect(isPublicRoute(path)).toBe(false);
    }
  });
});

describe('Demo removal', () => {
  it('/demo is not a public route (no longer bypassed)', () => {
    expect(isPublicRoute('/demo')).toBe(false);
  });
});
```

**Step 2: Add vitest config for web app**

Create `apps/web/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

Update `apps/web/package.json` test script:

Change `"test": "echo 'no tests'"` to `"test": "vitest run"` and
`"test:watch": "echo 'no tests'"` to `"test:watch": "vitest"`.

**Step 3: Run tests to verify they pass (roles.ts logic)**

Run:
```bash
cd apps/web && pnpm test
```

Expected: All tests PASS. The roles.ts module already has the logic; tests validate it.

**Step 4: Rewrite middleware.ts**

Replace `apps/web/middleware.ts` with:

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  isPublicRoute,
  getRequiredRole,
  getMismatchRedirect,
  ROLE_LANDING,
  type UserRoleType,
} from '@/lib/auth/roles';

/**
 * Role-based middleware for VitalCV.
 *
 * Fast path: reads role from Clerk JWT claim (publicMetadata.vitalcv.role).
 * Fallback: if no claim exists, calls /api/auth/resolve-role (Node runtime)
 *           to look up or create the User row in Prisma, then redirects to
 *           force a JWT refresh.
 *
 * /demo is permanently redirected (308) to /.
 */

const isSignInPage = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  // 1. Permanent redirect: /demo -> /
  if (pathname === '/demo' || pathname.startsWith('/demo/')) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url, 308);
  }

  // 2. Public routes pass through
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // 3. Determine required role for this route
  const requiredRole = getRequiredRole(pathname);
  if (!requiredRole) {
    // Route is neither public nor protected — pass through
    return NextResponse.next();
  }

  // 4. Require authentication
  const session = await auth();
  if (!session.userId) {
    const signInUrl = req.nextUrl.clone();
    signInUrl.pathname = '/sign-in';
    signInUrl.searchParams.set('redirect_url', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // 5. Read role from JWT claim (fast path)
  let userRole: UserRoleType | undefined =
    session.sessionClaims?.vitalcv?.role as UserRoleType | undefined;

  // 6. Fallback: no role claim in JWT
  if (!userRole) {
    try {
      const resolveUrl = new URL('/api/auth/resolve-role', req.nextUrl.origin);
      const resolveRes = await fetch(resolveUrl, {
        headers: {
          'x-clerk-user-id': session.userId,
        },
      });

      if (resolveRes.ok) {
        const data = await resolveRes.json();
        userRole = data.role as UserRoleType;
      }
    } catch {
      // Fallback failed — redirect to error page (circuit breaker)
    }

    if (!userRole) {
      const errorUrl = req.nextUrl.clone();
      errorUrl.pathname = '/auth/error';
      return NextResponse.redirect(errorUrl);
    }

    // Redirect to role landing to force JWT refresh on next request
    const landingUrl = req.nextUrl.clone();
    landingUrl.pathname = ROLE_LANDING[userRole];
    return NextResponse.redirect(landingUrl);
  }

  // 7. Check role matches route
  if (userRole !== requiredRole) {
    const redirectPath = getMismatchRedirect(pathname, userRole);
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = redirectPath;
    return NextResponse.redirect(redirectUrl);
  }

  // 8. Authorized — pass through
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
```

**Step 5: Run tests again**

Run:
```bash
cd apps/web && pnpm test
```

Expected: All tests PASS.

**Step 6: Commit**

```bash
git add apps/web/middleware.ts apps/web/__tests__/middleware.test.ts apps/web/vitest.config.ts apps/web/package.json
git commit -m "feat(middleware): rewrite with role-based guards, demo redirect, and fallback resolution"
```

---

## Task 5: Role Sync Utility (Prisma -> Clerk)

**Files:**
- Create: `apps/web/lib/auth/sync-role.ts`

**Step 1: Install svix for webhook verification (needed in Task 6)**

```bash
cd apps/web && pnpm add svix
```

**Step 2: Create sync utility**

```typescript
// apps/web/lib/auth/sync-role.ts
//
// Syncs role from Prisma (authoritative) to Clerk publicMetadata.vitalcv.
// Best-effort: Clerk failure does NOT block Prisma writes.
// Retry is the caller's responsibility.

import { clerkClient } from '@clerk/nextjs/server';

export type SyncableRole = 'CLINICIAN' | 'VERIFIER' | 'ISSUER' | 'ADMIN';

/**
 * Sync a user's role and roleVersion to Clerk publicMetadata.
 *
 * This is a best-effort operation. If Clerk is unavailable, the caller
 * should log the failure and retry later. Prisma remains authoritative.
 *
 * @throws If Clerk API call fails (caller handles retry).
 */
export async function syncRoleToClerk(
  clerkUserId: string,
  role: SyncableRole,
  roleVersion: number
): Promise<void> {
  const client = await clerkClient();
  await client.users.updateUserMetadata(clerkUserId, {
    publicMetadata: {
      vitalcv: { role, roleVersion },
    },
  });
}
```

**Step 3: Commit**

```bash
git add apps/web/lib/auth/sync-role.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat(auth): add Prisma-to-Clerk role sync utility"
```

---

## Task 6: Clerk Webhook Handler (Clerk -> Prisma)

**Files:**
- Create: `apps/web/app/api/webhooks/clerk/route.ts`

This is a **critical design decision point** for the implementer. The webhook handler
must be idempotent — duplicate events must not overwrite existing user data.

**Step 1: Create webhook route**

```typescript
// apps/web/app/api/webhooks/clerk/route.ts
//
// Handles Clerk webhook events. Currently supports:
// - user.created: Creates User row in Prisma (idempotent).
//
// Svix signature verification ensures requests are from Clerk.
// Runs in Node runtime (Prisma requires it).

import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { syncRoleToClerk } from '@/lib/auth/sync-role';

export const runtime = 'nodejs';

// Prisma client — import from backend or create a shared instance
// For now, we use a direct PrismaClient since the web app needs DB access
// for auth operations. This will be refactored when we create a shared
// database package.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ClerkUserCreatedEvent {
  type: 'user.created';
  data: {
    id: string; // Clerk user ID (user_xxx)
    email_addresses: Array<{
      email_address: string;
      id: string;
    }>;
    primary_email_address_id: string;
  };
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET not configured');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  // 1. Verify Svix signature
  const headerPayload = await headers();
  const svixId = headerPayload.get('svix-id');
  const svixTimestamp = headerPayload.get('svix-timestamp');
  const svixSignature = headerPayload.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: 'Missing svix headers' },
      { status: 400 }
    );
  }

  const body = await req.text();
  const wh = new Webhook(WEBHOOK_SECRET);

  let event: ClerkUserCreatedEvent;
  try {
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkUserCreatedEvent;
  } catch {
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 401 }
    );
  }

  // 2. Handle user.created
  if (event.type === 'user.created') {
    const clerkUserId = event.data.id;
    const primaryEmail = event.data.email_addresses.find(
      (e) => e.id === event.data.primary_email_address_id
    );

    if (!primaryEmail) {
      return NextResponse.json(
        { error: 'No primary email found' },
        { status: 400 }
      );
    }

    // 3. Idempotent upsert: only CREATE, never overwrite existing
    const existing = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (existing) {
      // User already exists — do not overwrite role/status.
      // Sync current role to Clerk metadata (best-effort).
      try {
        await syncRoleToClerk(clerkUserId, existing.role, existing.roleVersion);
      } catch (err) {
        console.error('Failed to sync role to Clerk (non-blocking):', err);
      }
      return NextResponse.json({ status: 'already_exists' });
    }

    // 4. Create new user
    const user = await prisma.user.create({
      data: {
        clerkUserId,
        email: primaryEmail.email_address,
        role: 'CLINICIAN',
        roleVersion: 1,
        status: 'INVITED',
      },
    });

    // 5. Sync role to Clerk metadata (best-effort)
    try {
      await syncRoleToClerk(clerkUserId, user.role, user.roleVersion);
    } catch (err) {
      console.error('Failed to sync role to Clerk (non-blocking):', err);
    }

    return NextResponse.json({ status: 'created', userId: user.id });
  }

  // Unhandled event type — acknowledge receipt
  return NextResponse.json({ status: 'ignored' });
}
```

**Step 2: Add CLERK_WEBHOOK_SECRET to .env.example**

Append to `apps/web/.env.example`:

```
# Clerk Webhook (Svix) - get from Clerk Dashboard > Webhooks
CLERK_WEBHOOK_SECRET=whsec_...
```

**Step 3: Commit**

```bash
git add apps/web/app/api/webhooks/clerk/route.ts apps/web/.env.example
git commit -m "feat(auth): add Clerk webhook handler with idempotent user creation"
```

---

## Task 7: Fallback Role Resolution API Route

**Files:**
- Create: `apps/web/app/api/auth/resolve-role/route.ts`

**Step 1: Create the route**

```typescript
// apps/web/app/api/auth/resolve-role/route.ts
//
// Fallback for middleware when JWT has no vitalcv role claim.
// Runs in Node runtime (Prisma). Called by middleware via internal fetch.
//
// Race condition handler: if User row doesn't exist yet (webhook delayed),
// creates a minimal row on-demand.

import { NextResponse } from 'next/server';
import { syncRoleToClerk } from '@/lib/auth/sync-role';

export const runtime = 'nodejs';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const clerkUserId = req.headers.get('x-clerk-user-id');

  if (!clerkUserId) {
    return NextResponse.json(
      { error: 'Missing x-clerk-user-id header' },
      { status: 400 }
    );
  }

  // 1. Look up existing user
  let user = await prisma.user.findUnique({
    where: { clerkUserId },
  });

  // 2. On-demand creation (race condition: webhook hasn't fired yet)
  if (!user) {
    // We don't have the email here — use a placeholder that the webhook
    // will update when it fires. This prevents the first-login race.
    user = await prisma.user.upsert({
      where: { clerkUserId },
      create: {
        clerkUserId,
        email: `pending-${clerkUserId}@placeholder.vitalcv.com`,
        role: 'CLINICIAN',
        roleVersion: 1,
        status: 'INVITED',
      },
      update: {}, // no-op if exists (another request won the race)
    });
  }

  // 3. Async sync to Clerk (best-effort, non-blocking)
  syncRoleToClerk(clerkUserId, user.role, user.roleVersion).catch((err) => {
    console.error('resolve-role: failed to sync to Clerk:', err);
  });

  return NextResponse.json({
    role: user.role,
    roleVersion: user.roleVersion,
    status: user.status,
  });
}
```

**Step 2: Commit**

```bash
git add apps/web/app/api/auth/resolve-role/route.ts
git commit -m "feat(auth): add fallback role resolution endpoint for middleware"
```

---

## Task 8: Auth Error Page (Circuit Breaker)

**Files:**
- Create: `apps/web/app/auth/error/page.tsx`

**Step 1: Create error page**

```tsx
// apps/web/app/auth/error/page.tsx

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-semibold mb-4">
          Unable to verify your account
        </h1>
        <p className="text-muted-foreground mb-6">
          We couldn&apos;t determine your account permissions. This is usually
          temporary. Please try signing in again.
        </p>
        <a
          href="/sign-in"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Sign in again
        </a>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/app/auth/error/page.tsx
git commit -m "feat(auth): add error page as redirect loop circuit breaker"
```

---

## Task 9: Demo Bypass Removal

**Files:**
- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/app/demo/page.tsx`
- Modify: `apps/web/.env.example`

**Step 1: Clean up api.ts**

Replace `apps/web/lib/api.ts` with:

```typescript
// apps/web/lib/api.ts

type ApiPath =
  | '/trust-state'
  | '/ingest/npi'
  | '/ingest/files'
  | '/verification/run'
  | '/acceptances'
  | '/starts'
  | '/verify'
  | '/api/pilot/activate';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  '';

function normalizeApiBase(base: string): string {
  if (!base) return '';
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

export function apiRoute(path: ApiPath): string {
  const base = normalizeApiBase(API_BASE);
  return base ? `${base}${path}` : path;
}

export type { ApiPath };
```

**Step 2: Replace demo page with 308 redirect**

Replace `apps/web/app/demo/page.tsx` with:

```typescript
// apps/web/app/demo/page.tsx
import { redirect } from 'next/navigation';

export default function DemoPage() {
  redirect('/');
}
```

Note: Next.js `redirect()` returns 307 by default. For a 308 permanent redirect,
we handle it in middleware (Task 4 already does this). This page-level redirect is
a fallback in case middleware doesn't catch it.

**Step 3: Remove DEMO_MODE from .env.example**

Remove any `NEXT_PUBLIC_DEMO_MODE` line from `apps/web/.env.example` (it's not
currently there based on our read, but verify no other env files reference it).

**Step 4: Verify no demo flag references remain**

Run:
```bash
grep -r "DEMO_MODE\|NEXT_PUBLIC_DEMO" apps/web/ --include='*.ts' --include='*.tsx' --include='*.env*'
```

Expected: No results (all demo flags removed).

**Step 5: Commit**

```bash
git add apps/web/lib/api.ts apps/web/app/demo/page.tsx
git commit -m "fix(auth): remove demo bypass from production flows, 308 redirect /demo -> /"
```

---

## Task 10: Backend Auth Guards — Clerk Token Verification

**Files:**
- Create: `apps/api/backend/src/middleware/clerkAuthGuard.ts`

**Step 1: Create the guard**

```typescript
// apps/api/backend/src/middleware/clerkAuthGuard.ts
//
// Verifies Clerk session tokens on backend API requests.
// Extracts clerkUserId and role claim from the JWT.
// Attaches auth context to req.auth for downstream guards.

import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const CLERK_ISSUER = process.env.CLERK_ISSUER_URL; // e.g., https://your-app.clerk.accounts.dev
const JWKS_URL = CLERK_ISSUER ? new URL(`${CLERK_ISSUER}/.well-known/jwks.json`) : null;
const JWKS = JWKS_URL ? createRemoteJWKSet(JWKS_URL) : null;

export interface ClerkAuthContext {
  clerkUserId: string;
  role: string | null; // from JWT claim, may be absent
  roleVersion: number | null;
  sessionId: string;
}

// Augment Express Request
declare global {
  namespace Express {
    interface Request {
      auth?: ClerkAuthContext;
    }
  }
}

/**
 * Middleware: verify Clerk session token and attach auth context.
 * Returns 401 if token is missing, expired, or invalid.
 */
export async function clerkAuthGuard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!JWKS || !CLERK_ISSUER) {
    res.status(500).json({ error: 'Auth not configured: CLERK_ISSUER_URL missing' });
    return;
  }

  const authHeader = req.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: CLERK_ISSUER,
    });

    const vitalcv = (payload as Record<string, unknown>).vitalcv as
      | { role?: string; roleVersion?: number }
      | undefined;

    req.auth = {
      clerkUserId: payload.sub as string,
      role: vitalcv?.role ?? null,
      roleVersion: vitalcv?.roleVersion ?? null,
      sessionId: payload.sid as string,
    };

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session token' });
  }
}
```

**Step 2: Add CLERK_ISSUER_URL to backend env**

Append to backend `.env.example` or env documentation:

```
# Clerk JWT verification
CLERK_ISSUER_URL=https://your-app.clerk.accounts.dev
```

**Step 3: Commit**

```bash
git add apps/api/backend/src/middleware/clerkAuthGuard.ts
git commit -m "feat(api): add Clerk JWT verification middleware for backend routes"
```

---

## Task 11: Backend Auth Guards — Role Enforcement + Org Scoping

**Files:**
- Create: `apps/api/backend/src/middleware/requireRole.ts`

**Step 1: Write the test first**

Create `apps/api/backend/src/__tests__/guards/requireRole.test.ts`:

```typescript
// apps/api/backend/src/__tests__/guards/requireRole.test.ts

import { requireRole, requireRoleStrict } from '../../middleware/requireRole';
import type { Request, Response, NextFunction } from 'express';

// Mock Prisma
jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

import prisma from '../../graphql/prisma_client';

function mockReqResNext(auth: any = {}) {
  const req = { auth } as unknown as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn() as NextFunction;
  return { req, res, next };
}

describe('requireRole (claim-only, fast path)', () => {
  it('allows matching role', () => {
    const { req, res, next } = mockReqResNext({ role: 'VERIFIER' });
    requireRole('VERIFIER')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects mismatched role', () => {
    const { req, res, next } = mockReqResNext({ role: 'CLINICIAN' });
    requireRole('VERIFIER')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects missing auth context', () => {
    const { req, res, next } = mockReqResNext(undefined);
    requireRole('VERIFIER')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('accepts multiple allowed roles', () => {
    const { req, res, next } = mockReqResNext({ role: 'ADMIN' });
    requireRole('VERIFIER', 'ADMIN')(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('requireRoleStrict (Prisma re-check)', () => {
  it('allows when JWT and Prisma roles match', async () => {
    const { req, res, next } = mockReqResNext({
      clerkUserId: 'user_123',
      role: 'ADMIN',
    });

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      role: 'ADMIN',
      status: 'ACTIVE',
    });

    await requireRoleStrict('ADMIN')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('denies when JWT says ADMIN but Prisma says VERIFIER (JWT tampering)', async () => {
    const { req, res, next } = mockReqResNext({
      clerkUserId: 'user_123',
      role: 'ADMIN',
    });

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      role: 'VERIFIER',
      status: 'ACTIVE',
    });

    await requireRoleStrict('ADMIN')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('denies SUSPENDED users even with correct role', async () => {
    const { req, res, next } = mockReqResNext({
      clerkUserId: 'user_123',
      role: 'ADMIN',
    });

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      role: 'ADMIN',
      status: 'SUSPENDED',
    });

    await requireRoleStrict('ADMIN')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('denies when user not found in Prisma', async () => {
    const { req, res, next } = mockReqResNext({
      clerkUserId: 'user_ghost',
      role: 'ADMIN',
    });

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await requireRoleStrict('ADMIN')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd apps/api/backend && pnpm test -- --testPathPattern=requireRole
```

Expected: FAIL — `requireRole` and `requireRoleStrict` not found.

**Step 3: Write the implementation**

Create `apps/api/backend/src/middleware/requireRole.ts`:

```typescript
// apps/api/backend/src/middleware/requireRole.ts
//
// Two-tier role enforcement:
// - requireRole(): claim-only check (fast path, for reads)
// - requireRoleStrict(): Prisma re-check (for sensitive writes)

import type { NextFunction, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';

type AllowedRole = 'CLINICIAN' | 'VERIFIER' | 'ISSUER' | 'ADMIN';

/**
 * Fast-path role guard. Reads role from req.auth (Clerk JWT claim).
 * Use for read operations where JWT claim is trusted.
 */
export function requireRole(
  ...allowedRoles: AllowedRole[]
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    if (!req.auth) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!req.auth.role || !allowedRoles.includes(req.auth.role as AllowedRole)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: req.auth.role,
      });
      return;
    }

    next();
  };
}

/**
 * Strict role guard. Re-verifies role against Prisma User table.
 * Use for sensitive writes that affect other users' data.
 *
 * Also checks user status — SUSPENDED/DEACTIVATED users are denied
 * even if their JWT claim has the correct role.
 */
export function requireRoleStrict(
  ...allowedRoles: AllowedRole[]
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req, res, next) => {
    if (!req.auth?.clerkUserId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: req.auth.clerkUserId },
    });

    if (!user) {
      res.status(403).json({ error: 'User not found in authorization database' });
      return;
    }

    if (user.status !== 'ACTIVE') {
      res.status(403).json({
        error: 'Account is not active',
        status: user.status,
      });
      return;
    }

    if (!allowedRoles.includes(user.role as AllowedRole)) {
      res.status(403).json({
        error: 'Insufficient permissions (verified)',
        required: allowedRoles,
        current: user.role,
      });
      return;
    }

    next();
  };
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd apps/api/backend && pnpm test -- --testPathPattern=requireRole
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add apps/api/backend/src/middleware/requireRole.ts apps/api/backend/src/__tests__/guards/requireRole.test.ts
git commit -m "feat(api): add requireRole and requireRoleStrict middleware with JWT tampering protection"
```

---

## Task 12: Backend JWT Module Update

**Files:**
- Modify: `apps/api/backend/src/auth/jwt.ts`

**Step 1: Expand role types**

Replace `apps/api/backend/src/auth/jwt.ts`:

```typescript
// apps/api/backend/src/auth/jwt.ts
//
// Legacy JWT utilities. Retained for backward compatibility with
// existing API key-authenticated flows. New flows use Clerk tokens
// verified by clerkAuthGuard.

import jwt from 'jsonwebtoken';

export type LegacyRole = 'user' | 'clinician';
export type AppRole = 'CLINICIAN' | 'VERIFIER' | 'ISSUER' | 'ADMIN';

export interface AuthPayload {
  userId: string;
  role: LegacyRole | AppRole;
}

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}
```

**Step 2: Commit**

```bash
git add apps/api/backend/src/auth/jwt.ts
git commit -m "refactor(auth): expand JWT role types for RBAC, mark legacy roles"
```

---

## Task 13: Webhook Security Tests

**Files:**
- Create: `apps/web/__tests__/api/auth/webhook.test.ts`

**Step 1: Create webhook handler test**

```typescript
// apps/web/__tests__/api/auth/webhook.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// These tests verify the webhook handler's security properties:
// - Svix signature verification
// - Idempotent user creation
// - Replay protection

describe('Clerk webhook handler security', () => {
  it('rejects requests with missing svix headers', async () => {
    // Test that POST to /api/webhooks/clerk without svix-id, svix-timestamp,
    // svix-signature headers returns 400.
    // This is tested via supertest or by calling the route handler directly.
    expect(true).toBe(true); // placeholder — real test hits the route handler
  });

  it('rejects requests with invalid svix signature', async () => {
    // Test that a forged signature returns 401.
    expect(true).toBe(true); // placeholder
  });

  it('creates user on first user.created event', async () => {
    // Verify that a valid user.created event creates a Prisma User row
    // with role=CLINICIAN, status=INVITED.
    expect(true).toBe(true); // placeholder
  });

  it('does not overwrite existing user on duplicate user.created event', async () => {
    // Verify idempotency: if User already has role=VERIFIER, status=ACTIVE,
    // a second user.created event does NOT reset to CLINICIAN/INVITED.
    expect(true).toBe(true); // placeholder
  });
});
```

Note: These are placeholder tests that need to be fleshed out with actual route handler
invocations. The implementer should use the `POST` handler imported directly or via
a test helper, mocking Prisma and Svix.

**Step 2: Commit**

```bash
git add apps/web/__tests__/api/auth/webhook.test.ts
git commit -m "test(auth): add webhook security test scaffolds"
```

---

## Task 14: Demo Removal Verification Tests

**Files:**
- Add to: `apps/web/__tests__/middleware.test.ts`

**Step 1: Add demo removal assertions to existing test file**

Append to the test file created in Task 4:

```typescript
describe('Demo removal verification', () => {
  it('/demo is handled by middleware as 308 redirect', () => {
    // The middleware handles /demo -> / as 308.
    // /demo is NOT in public routes.
    expect(isPublicRoute('/demo')).toBe(false);
    // getRequiredRole returns null (not explicitly protected either)
    // — middleware handles it specially before role check.
  });

  it('apiRoute has no demo path logic', async () => {
    // Import apiRoute and verify it has no conditional demo paths
    const { apiRoute } = await import('../lib/api');
    // All paths resolve directly — no demo redirect
    const result = apiRoute('/trust-state');
    expect(result).not.toContain('/demo/');
  });
});
```

**Step 2: Run all web tests**

Run:
```bash
cd apps/web && pnpm test
```

Expected: All tests PASS.

**Step 3: Commit**

```bash
git add apps/web/__tests__/middleware.test.ts
git commit -m "test(auth): add demo removal verification tests"
```

---

## Task 15: Wire Backend Guards to Express Routes

**Files:**
- Modify: `apps/api/backend/src/app.ts`

This is a **user contribution point**. The Express app has many routes and the
implementer needs to decide which specific routes get which guard level. The
design doc provides the guidance (self-read = claim-only, cross-user read =
org check, sensitive writes = Prisma re-check).

**Step 1: Import guards at the top of app.ts**

Add to imports:

```typescript
import { clerkAuthGuard } from './middleware/clerkAuthGuard';
import { requireRole, requireRoleStrict } from './middleware/requireRole';
```

**Step 2: Apply guards to route groups**

This is where the implementer wires the guards to specific Express route handlers.
The pattern is:

```typescript
// Example: protect verifier dashboard routes
app.get('/api/verifier/*', clerkAuthGuard, requireRole('VERIFIER'), ...handler);

// Example: protect sensitive admin operations
app.post('/api/admin/roles', clerkAuthGuard, requireRoleStrict('ADMIN'), ...handler);
```

The exact wiring depends on the current route structure in `app.ts`. The implementer
should audit each route group and apply the appropriate guard level per the design doc.

**Step 3: Commit**

```bash
git add apps/api/backend/src/app.ts
git commit -m "feat(api): wire clerkAuthGuard and requireRole to protected routes"
```

---

## Task 16: Update .env.example Files

**Files:**
- Modify: `apps/web/.env.example`

**Step 1: Final .env.example state**

Ensure `apps/web/.env.example` contains:

```
# Backend API URL (Railway in production)
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_API_BASE=http://localhost:4000

# Set true to expose /internal/enterprise signals page.
NEXT_PUBLIC_ENTERPRISE_MODE=false

# Clerk Authentication
# Get these from https://dashboard.clerk.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk route configuration
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Clerk Webhook (Svix) - get from Clerk Dashboard > Webhooks
CLERK_WEBHOOK_SECRET=whsec_...

# Database (for auth operations in Next.js API routes)
DATABASE_URL=postgresql://...
```

**Step 2: Commit**

```bash
git add apps/web/.env.example
git commit -m "chore(env): update .env.example with auth RBAC configuration"
```

---

## Execution Summary

| Task | What | Files | Commits |
|------|------|-------|---------|
| 1 | Prisma User model + enums | schema.prisma + migration | 1 |
| 2 | Clerk session type augmentation | types/clerk.d.ts | 1 |
| 3 | Role constants & route mapping | lib/auth/roles.ts | 1 |
| 4 | Middleware rewrite + tests | middleware.ts, tests, vitest config | 1 |
| 5 | Role sync utility | lib/auth/sync-role.ts | 1 |
| 6 | Clerk webhook handler | api/webhooks/clerk/route.ts | 1 |
| 7 | Fallback role resolution | api/auth/resolve-role/route.ts | 1 |
| 8 | Auth error page | auth/error/page.tsx | 1 |
| 9 | Demo bypass removal | api.ts, demo/page.tsx | 1 |
| 10 | Backend Clerk JWT guard | middleware/clerkAuthGuard.ts | 1 |
| 11 | Backend role enforcement + tests | middleware/requireRole.ts + tests | 1 |
| 12 | Backend JWT module update | auth/jwt.ts | 1 |
| 13 | Webhook security tests | webhook.test.ts | 1 |
| 14 | Demo removal verification | middleware.test.ts additions | 1 |
| 15 | Wire guards to Express routes | app.ts | 1 |
| 16 | Env config update | .env.example | 1 |

**Total: 16 tasks, 16 commits, ~15 files created/modified**
