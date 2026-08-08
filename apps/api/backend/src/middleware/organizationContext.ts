import type { NextFunction, Request, Response } from 'express';

import type { VerifiedAuth } from './verifiedIdentity';

type OrganizationRequest = Request & {
  organizationId?: string;
  /**
   * Set by `bindOrganizationContext` once org binding has run in `enforce`.
   * Its presence means "org context has already been decided from verified
   * membership" — so `getRequestOrganizationId` must NOT fall back to the
   * caller-supplied query/header sources. Without this flag, enforce would
   * bind a verified org and then silently hand the header value back to any
   * caller whose verified membership resolved to nothing.
   */
  organizationBindingEnforced?: boolean;
};

function parseOrganizationId(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return parseOrganizationId(value[0]);
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseOrganizationFromQuery(req: Request): string | undefined {
  return parseOrganizationId(req.query.organizationId);
}

function parseOrganizationFromHeader(req: Request): string | undefined {
  return parseOrganizationId(req.get('x-org-id'));
}

// Org context comes from the pre-attached request or — only while
// TENANT_ORG_BINDING is not `enforce` — `?organizationId=` / `x-org-id`.
// Authorization bearer tokens are deliberately NOT parsed here: the legacy
// HS256 verifier fell back to a hardcoded dev secret (ASVS 2.10.2, gap G6) and
// nothing in the platform mints such tokens — do not re-add a shared-secret
// token path. Verified identity arrives via `verifiedIdentity.ts` instead.
//
// The query/header sources are unauthenticated (gap G1, ASVS 14.5.4 / 4.1.2).
// `tenantGuard.ts#bindOrganizationContext` is what closes that; until it is at
// `enforce` these sources remain caller-supplied and are NOT an authorization
// boundary. See docs/security/tenant-org-binding.md.
export function getRequestOrganizationId(req: Request): string | undefined {
  const attached = (req as OrganizationRequest).organizationId;
  if (typeof attached === 'string' && attached.trim().length > 0) {
    return attached.trim();
  }

  if ((req as OrganizationRequest).organizationBindingEnforced) {
    return undefined;
  }

  return parseOrganizationFromQuery(req) ?? parseOrganizationFromHeader(req);
}

/**
 * The org id the caller ASSERTED, independent of what was bound. Only for
 * shadow telemetry — never for an authorization decision.
 */
export function getAssertedOrganizationId(req: Request): string | undefined {
  return parseOrganizationFromQuery(req) ?? parseOrganizationFromHeader(req);
}

// ─── Verified org membership ────────────────────────────────────────────────

/**
 * Membership lookups are per-request on the global middleware path, so they are
 * cached briefly. The TTL is deliberately short: an org move or a deactivation
 * must take effect quickly, and 30s bounds the staleness window while still
 * collapsing a burst of polling requests into one query.
 */
const MEMBERSHIP_CACHE_TTL_MS = 30_000;
const MEMBERSHIP_CACHE_MAX = 5_000;
const membershipCache = new Map<string, { organizationId: string | null; expiresAt: number }>();

/**
 * Prisma is resolved lazily, on first membership lookup. This middleware sits
 * on the global mount, so a static import would pull a PrismaClient into the
 * module graph of everything that touches the tenant guard — instantiating a
 * client (and its connection handle) even at TENANT_ORG_BINDING=off, where no
 * lookup ever happens. `off` should cost nothing, including a module load.
 */
type MembershipStore = {
  user: {
    findUnique: (args: {
      where: { clerkUserId: string };
      select: { organizationId: true };
    }) => Promise<{ organizationId: string | null } | null>;
  };
};

let membershipStore: MembershipStore | null = null;

function getMembershipStore(): MembershipStore {
  if (!membershipStore) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    membershipStore = require('../graphql/prisma_client').default as MembershipStore;
  }
  return membershipStore;
}

/** Test seam — reset between cases so a cached miss cannot leak across tests. */
export function clearOrganizationMembershipCache(): void {
  membershipCache.clear();
  membershipStore = null;
}

/**
 * Resolve the caller's organization from the membership store, keyed on their
 * VERIFIED Clerk id. This is the only acceptable source of org scope: `x-org-id`
 * and `?organizationId=` are caller-supplied, and holding an org id is not
 * membership in it.
 *
 * Mirrors `routes/activation.ts#resolveCallerOrganizationId`, the pattern that
 * closed #951. `User.organizationId` is the membership store — one org per
 * user, nullable (clinicians have none, which is why a null result must mean
 * "no org context", never "fall back to what they claimed").
 */
export async function resolveVerifiedOrganizationId(req: Request): Promise<string | null> {
  const verifiedUserId = (req as Request & { verifiedAuth?: VerifiedAuth })
    .verifiedAuth?.verifiedUserId?.trim();

  // No verified identity → no membership → no org context. In `off` mode
  // `verifiedAuth` is never set at all (verifiedIdentity returns early), which
  // is exactly why enforce requires CLERK_JWT_VERIFICATION to be on.
  if (!verifiedUserId) {
    return null;
  }

  const cached = membershipCache.get(verifiedUserId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.organizationId;
  }

  let organizationId: string | null = null;
  try {
    const user = await getMembershipStore().user.findUnique({
      where: { clerkUserId: verifiedUserId },
      select: { organizationId: true },
    });
    organizationId = user?.organizationId ?? null;
  } catch {
    // A membership lookup that fails must not fall open into "no constraint".
    // Returning null denies org context, which is the fail-closed direction.
    return null;
  }

  if (membershipCache.size >= MEMBERSHIP_CACHE_MAX) {
    membershipCache.clear();
  }
  membershipCache.set(verifiedUserId, {
    organizationId,
    expiresAt: Date.now() + MEMBERSHIP_CACHE_TTL_MS,
  });

  return organizationId;
}

export function requireOrganizationContext(req: Request, _res: Response, next: NextFunction): void {
  const organizationId = getRequestOrganizationId(req);
  if (organizationId) {
    (req as OrganizationRequest).organizationId = organizationId;
  }

  next();
}
