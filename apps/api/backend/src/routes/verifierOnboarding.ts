import crypto from 'crypto';
import type { Express, Request, Response } from 'express';
import {
  VerifierLifecycle,
  assessVerifierLifecycleTransition,
  coerceVerifierLifecycle,
  createVerifierLifecycleTransitionError,
  getVerifierLifecycleEventType,
  isVerifierLifecycleAtLeast,
  logLifecycleTransitionPersistenceFailure,
  logVerifierLifecycleTransitionEvent,
} from '../services/verifierLifecycle';
import { log } from '../obs/logger';
import prisma, { Prisma } from '../graphql/prisma_client';

const TOKEN_EXPIRY_DAYS = 30;
const TOKEN_BYTE_LENGTH = 32;

type OnboardingEventType =
  | 'VERIFIER_REGISTERED'
  | 'VERIFIER_TOKEN_USED'
  | 'PILOT_ACTIVATED';

function parseBooleanEnv(raw: string | undefined): boolean {
  if (!raw) {
    return false;
  }

  const normalized = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

const LOW_FRICTION_MODE = parseBooleanEnv(process.env.LOW_FRICTION_MODE);

function generateAccessToken(): string {
  return crypto.randomBytes(TOKEN_BYTE_LENGTH).toString('hex');
}

function computeTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + TOKEN_EXPIRY_DAYS);
  return expiry;
}

function toAuditHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function parseRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function parseEmail(value: unknown, field: string): string {
  const email = parseRequiredString(value, field);
  if (!email.includes('@')) {
    throw new Error(`${field} must be a valid email address`);
  }
  return email.toLowerCase();
}

async function logOnboardingEvent(
  eventType: OnboardingEventType,
  verifierOrgId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        type: eventType,
        hash: toAuditHash(`${eventType}:${verifierOrgId}:${Date.now()}`),
        referenceId: verifierOrgId,
        organizationId: verifierOrgId,
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch {
    // Fire-and-forget: onboarding event logging must not block the request
  }
}

async function transitionVerifierLifecycle(
  verifierOrgId: string,
  targetLifecycle: VerifierLifecycle,
  metadata?: Record<string, unknown>,
): Promise<VerifierLifecycle> {
  const verifierOrg = await prisma.verifierOrg.findUnique({
    where: { id: verifierOrgId },
    select: { id: true, lifecycle: true, pilotActivated: true },
  });

  if (!verifierOrg) {
    throw new Error('Verifier organization not found');
  }

  const currentLifecycle = coerceVerifierLifecycle(verifierOrg.lifecycle);
  const transition = assessVerifierLifecycleTransition(currentLifecycle, targetLifecycle);

  if (!transition.allowed) {
    throw createVerifierLifecycleTransitionError(
      currentLifecycle,
      targetLifecycle,
      transition.reason ?? 'Transition blocked by verifier lifecycle policy',
    );
  }

  if (transition.noOp) {
    return currentLifecycle;
  }

  const updateResult = await prisma.verifierOrg.updateMany({
    where: {
      id: verifierOrgId,
      lifecycle: currentLifecycle,
    },
    data: {
      lifecycle: targetLifecycle,
      pilotActivated: isVerifierLifecycleAtLeast(targetLifecycle, 'PILOT_ACTIVATED'),
    },
  });

  if (updateResult.count !== 1) {
    throw new Error('Verifier lifecycle transition raced or was already applied.');
  }

  try {
    await logVerifierLifecycleTransitionEvent(verifierOrgId, currentLifecycle, targetLifecycle, {
      ...metadata,
      eventType: getVerifierLifecycleEventType(targetLifecycle),
    });

    return targetLifecycle;
  } catch (error) {
    await prisma.verifierOrg.updateMany({
      where: { id: verifierOrgId, lifecycle: targetLifecycle },
      data: {
        lifecycle: currentLifecycle,
        pilotActivated: isVerifierLifecycleAtLeast(currentLifecycle, 'PILOT_ACTIVATED'),
      },
    });

    logLifecycleTransitionPersistenceFailure(
      verifierOrgId,
      currentLifecycle,
      targetLifecycle,
      error instanceof Error ? error.message : 'Unknown persistence error',
    );

    throw error instanceof Error ? error : new Error('Failed to persist verifier lifecycle transition');
  }
}

export function registerVerifierOnboardingRoutes(app: Express): void {
  // ── POST /api/verifier/register ────────────────────────────
  // Creates a VerifierOrg + issues a 30-day access token.
  app.post('/api/verifier/register', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    try {
      const name = parseRequiredString(body.name, 'name');
      const contactName = parseRequiredString(body.contactName, 'contactName');
      const contactEmail = parseEmail(body.contactEmail, 'contactEmail');

      const verifierOrg = await prisma.verifierOrg.create({
        data: {
          name,
          contactName,
          contactEmail,
        },
      });

      const token = generateAccessToken();
      const expiresAt = computeTokenExpiry();

      await prisma.verifierAccessToken.create({
        data: {
          verifierOrgId: verifierOrg.id,
          token,
          expiresAt,
        },
      });

      const transitionedToTokenSent = await transitionVerifierLifecycle(
        verifierOrg.id,
        'TOKEN_SENT',
        {
          tokenId: token,
          source: 'register',
        },
      );

      if (LOW_FRICTION_MODE) {
        await transitionVerifierLifecycle(
          verifierOrg.id,
          'TOKEN_USED',
          {
            tokenId: token,
            autoValidated: true,
            source: 'register_low_friction',
          },
        );

        log('info', 'Low-friction verifier onboarding auto-validated token usage', {
          event: 'verifier_low_friction_auto_validation',
          verifierOrgId: verifierOrg.id,
          tokenId: token,
          lifecycle: transitionedToTokenSent,
        });
      }

      void logOnboardingEvent('VERIFIER_REGISTERED', verifierOrg.id, {
        name,
        contactEmail,
      });

      return res.status(201).json({
        id: verifierOrg.id,
        name: verifierOrg.name,
        contactName: verifierOrg.contactName,
        contactEmail: verifierOrg.contactEmail,
        activationUrl: `/verify-access/${token}`,
        tokenExpiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to register verifier organization';
      return res.status(400).json({ error: message });
    }
  });

  // ── GET /verify-access/:token ──────────────────────────────
  // Validates the access token, activates the pilot if needed,
  // and redirects to the verifier dashboard.
  app.get('/verify-access/:token', async (req: Request, res: Response) => {
    try {
      const rawToken = parseRequiredString(req.params.token, 'token');

      const accessToken = await prisma.verifierAccessToken.findUnique({
        where: { token: rawToken },
        include: {
          verifierOrg: {
            select: {
              id: true,
              lifecycle: true,
              pilotActivated: true,
            },
          },
        },
      });

      if (!accessToken) {
        return res.status(403).json({ error: 'Invalid or expired access token' });
      }

      const now = new Date();
      if (accessToken.expiresAt < now) {
        return res.status(403).json({ error: 'Access token has expired' });
      }

      const verifierOrgId = accessToken.verifierOrg.id;
      const lifecycleBefore = coerceVerifierLifecycle(accessToken.verifierOrg.lifecycle);

      await transitionVerifierLifecycle(verifierOrgId, 'TOKEN_USED', {
        tokenId: accessToken.id,
        source: 'verify_access',
      });

      await transitionVerifierLifecycle(verifierOrgId, 'PILOT_ACTIVATED', {
        tokenId: accessToken.id,
        source: 'verify_access',
      });

      void logOnboardingEvent('VERIFIER_TOKEN_USED', verifierOrgId, {
        tokenId: accessToken.id,
        lifecycleBefore,
        lowFrictionMode: LOW_FRICTION_MODE,
      });

      if (!accessToken.verifierOrg.pilotActivated) {
        void logOnboardingEvent('PILOT_ACTIVATED', verifierOrgId, {
          tokenId: accessToken.id,
          lifecycleBefore,
          source: 'verify_access_transition',
        });
      }

      return res.redirect(
        302,
        `/verifier?organizationId=${accessToken.verifierOrg.id}`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to validate access token';
      return res.status(400).json({ error: message });
    }
  });

  // ── GET /api/internal/verifiers ────────────────────────────
  // Internal dashboard: lists all verifier orgs, token stats,
  // activation status. Protected by INTERNAL_DASH_PASSWORD.
  app.get('/api/internal/verifiers', async (req: Request, res: Response) => {
    const password = process.env.INTERNAL_DASH_PASSWORD;
    const authHeader = req.headers.authorization;

    if (!password || authHeader !== `Bearer ${password}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const now = new Date();

      const [allOrgs, allTokens] = await Promise.all([
        prisma.verifierOrg.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            tokens: {
              select: { id: true, expiresAt: true, createdAt: true },
            },
          },
          select: {
            id: true,
            name: true,
            contactName: true,
            contactEmail: true,
            createdAt: true,
            lifecycle: true,
            pilotActivated: true,
            tokens: true,
          },
        }),
        prisma.verifierAccessToken.findMany({
          select: { id: true, expiresAt: true, verifierOrgId: true },
        }),
      ]);

      const totalVerifiers = allOrgs.length;
      const activePilots = allOrgs.filter((org) =>
        isVerifierLifecycleAtLeast(org.lifecycle, 'PILOT_ACTIVATED'),
      ).length;

      const lifecycleByOrg = new Map(
        allOrgs.map((org) => [org.id, coerceVerifierLifecycle(org.lifecycle)]),
      );

      let pendingTokens = 0;
      let expiredTokens = 0;

      for (const token of allTokens) {
        if (token.expiresAt < now) {
          expiredTokens++;
          continue;
        }

        const lifecycle = lifecycleByOrg.get(token.verifierOrgId) ?? 'REGISTERED';
        if (lifecycle === 'TOKEN_SENT') {
          pendingTokens++;
        }
      }

      const verifiers = allOrgs.map((org) => ({
        id: org.id,
        name: org.name,
        contactName: org.contactName,
        contactEmail: org.contactEmail,
        createdAt: org.createdAt.toISOString(),
        lifecycle: coerceVerifierLifecycle(org.lifecycle),
        pilotActivated: isVerifierLifecycleAtLeast(
          coerceVerifierLifecycle(org.lifecycle),
          'PILOT_ACTIVATED',
        ),
        tokenCount: org.tokens.length,
        hasExpiredTokens: org.tokens.some((t) => t.expiresAt < now),
      }));

      return res.status(200).json({
        totalVerifiers,
        activePilots,
        pendingTokens,
        expiredTokens,
        verifiers,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load verifier list';
      return res.status(500).json({ error: message });
    }
  });
}
