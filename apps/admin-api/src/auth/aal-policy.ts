/**
 * AAL Policy Service
 *
 * Manages Authentication Assurance Level (AAL) policies
 * according to NIST SP 800-63B:
 * - AAL2: Multi-factor authenticator or two separate factors
 * - AAL3: Device-bound cryptographic authenticator (phishing-resistant)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AalPolicyConfig {
  aalLevel: 1 | 2 | 3;
  requiresPhishingResistant: boolean;
  allowedAuthenticatorTypes: string[];
  config?: {
    minAuthenticators?: number;
    requireDeviceBound?: boolean;
    timeoutMinutes?: number;
  };
}

export interface UserAalStatus {
  userId: string;
  currentAal: number;
  requiredAal: number;
  meetsRequirement: boolean;
  authenticators: {
    id: string;
    type: string;
    deviceBound: boolean;
    phishingResistant: boolean;
  }[];
  error?: string;
}

/**
 * Get AAL policy for a user (by role or explicit assignment)
 */
export async function getUserAalPolicy(
  userId: string,
  userRoles: string[]
): Promise<AalPolicyConfig | null> {
  // Check for explicit user assignment
  const assignment = await prisma.userAalAssignment.findFirst({
    where: {
      userId,
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: { policy: true },
    orderBy: { assignedAt: 'desc' },
  });

  if (assignment) {
    const policy = assignment.policy;
    return {
      aalLevel: policy.aalLevel as 1 | 2 | 3,
      requiresPhishingResistant: policy.requiresPhishingResistant,
      allowedAuthenticatorTypes: policy.allowedAuthenticatorTypes,
      config: policy.config as any,
    };
  }

  // Default policy based on role
  // Admin roles require AAL3, verifiers require AAL2
  if (userRoles.includes('admin')) {
    return {
      aalLevel: 3,
      requiresPhishingResistant: true,
      allowedAuthenticatorTypes: ['webauthn'],
      config: {
        minAuthenticators: 1,
        requireDeviceBound: true,
      },
    };
  }

  if (userRoles.includes('verifier')) {
    return {
      aalLevel: 2,
      requiresPhishingResistant: true, // AAL2 requires phishing-resistant
      allowedAuthenticatorTypes: ['webauthn'],
      config: {
        minAuthenticators: 1,
      },
    };
  }

  // Default AAL1 for other users
  return {
    aalLevel: 1,
    requiresPhishingResistant: false,
    allowedAuthenticatorTypes: ['password'],
  };
}

/**
 * Check if user meets AAL requirements
 */
export async function checkUserAalCompliance(
  userId: string,
  userRoles: string[]
): Promise<UserAalStatus> {
  const policy = await getUserAalPolicy(userId, userRoles);
  if (!policy) {
    throw new Error('No AAL policy found for user');
  }

  // Get user's authenticators
  const authenticators = await prisma.webAuthnAuthenticator.findMany({
    where: {
      userId,
      revokedAt: null,
    },
  });

  // Determine current AAL based on authenticators
  let currentAal = 1;
  const hasPhishingResistant = authenticators.some(
    (auth) => true // WebAuthn is always phishing-resistant
  );
  const hasDeviceBound = authenticators.some((auth) => auth.deviceBound);

  if (authenticators.length > 0) {
    if (hasDeviceBound) {
      currentAal = 3; // Device-bound = AAL3
    } else if (hasPhishingResistant) {
      currentAal = 2; // Phishing-resistant = AAL2
    } else {
      currentAal = 1;
    }
  }

  // Enforce policy requirements
  const meetsRequirement = currentAal >= policy.aalLevel;

  // B111A-AAL-015: AAL2 requires phishing-resistant authenticator; denies weak factors
  if (policy.aalLevel === 2) {
    // Check for weak factors (password-only, SMS OTP, etc.)
    const hasWeakFactor = authenticators.length === 0 ||
      authenticators.every(auth => !auth.phishingResistant);

    if (!hasPhishingResistant || hasWeakFactor) {
      return {
        userId,
        currentAal,
        requiredAal: policy.aalLevel,
        meetsRequirement: false,
        authenticators: authenticators.map((auth) => ({
          id: auth.id,
          type: 'webauthn',
          deviceBound: auth.deviceBound,
          phishingResistant: true,
        })),
        error: 'AAL2 requires phishing-resistant authenticator. Weak factors (password, SMS OTP) are denied.',
      };
    }
  }

  // B111A-AAL-015: AAL3 requires device-bound authenticator; enforces HW-bound
  if (policy.aalLevel === 3) {
    if (!hasDeviceBound) {
      return {
        userId,
        currentAal,
        requiredAal: policy.aalLevel,
        meetsRequirement: false,
        authenticators: authenticators.map((auth) => ({
          id: auth.id,
          type: 'webauthn',
          deviceBound: auth.deviceBound,
          phishingResistant: true,
        })),
        error: 'AAL3 requires device-bound (hardware-bound) authenticator. Software authenticators are not sufficient.',
      };
    }
  }

  return {
    userId,
    currentAal,
    requiredAal: policy.aalLevel,
    meetsRequirement,
    authenticators: authenticators.map((auth) => ({
      id: auth.id,
      type: 'webauthn',
      deviceBound: auth.deviceBound,
      phishingResistant: true, // WebAuthn is phishing-resistant
    })),
  };
}

/**
 * Create or update AAL policy
 */
export async function upsertAalPolicy(
  name: string,
  config: AalPolicyConfig,
  description?: string
): Promise<string> {
  const policy = await prisma.aalPolicy.upsert({
    where: { name },
    update: {
      description,
      aalLevel: config.aalLevel,
      requiresPhishingResistant: config.requiresPhishingResistant,
      allowedAuthenticatorTypes: config.allowedAuthenticatorTypes,
      config: config.config as any,
      updatedAt: new Date(),
    },
    create: {
      name,
      description,
      aalLevel: config.aalLevel,
      requiresPhishingResistant: config.requiresPhishingResistant,
      allowedAuthenticatorTypes: config.allowedAuthenticatorTypes,
      config: config.config as any,
    },
  });

  return policy.id;
}

/**
 * Assign AAL policy to user
 */
export async function assignAalPolicyToUser(
  userId: string,
  policyId: string,
  assignedBy?: string,
  expiresAt?: Date
): Promise<void> {
  await prisma.userAalAssignment.upsert({
    where: {
      userId_policyId: {
        userId,
        policyId,
      },
    },
    update: {
      assignedBy,
      expiresAt,
      isActive: true,
    },
    create: {
      userId,
      policyId,
      assignedBy,
      expiresAt,
    },
  });
}

