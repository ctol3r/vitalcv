/**
 * WebAuthn Service
 *
 * Handles WebAuthn registration and authentication flows
 * for phishing-resistant MFA (AAL2/AAL3).
 */

import { PrismaClient } from '@prisma/client';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type GenerateRegistrationOptionsOpts,
  type VerifyRegistrationResponseOpts,
  type GenerateAuthenticationOptionsOpts,
  type VerifyAuthenticationResponseOpts,
} from '@simplewebauthn/server';
import type {
  AuthenticatorTransportFuture,
  PublicKeyCredentialDescriptorFuture,
} from '@simplewebauthn/server';
import { challengeStore } from './challenge-store';

const prisma = new PrismaClient();

export interface WebAuthnUser {
  id: string;
  email: string;
  name: string;
}

export interface RegistrationChallenge {
  options: any;
  challengeId: string;
}

export interface AuthenticationChallenge {
  options: any;
  challengeId: string;
}

/**
 * Get Relying Party (RP) configuration from environment
 */
function getRPConfig() {
  const rpId = process.env.WEBAUTHN_RP_ID || 'localhost';
  const rpName = process.env.WEBAUTHN_RP_NAME || 'VitalCV Platform';
  const origin = process.env.WEBAUTHN_ORIGIN || `http://${rpId}:3000`;

  return { rpId, rpName, origin };
}

/**
 * Generate registration options for a new WebAuthn authenticator
 */
export async function generateRegistrationOptionsForUser(
  user: WebAuthnUser,
  requireDeviceBound: boolean = false
): Promise<RegistrationChallenge> {
  const { rpId, rpName } = getRPConfig();

  // Get existing authenticators for this user
  const existingAuthenticators = await prisma.webAuthnAuthenticator.findMany({
    where: {
      userId: user.id,
      revokedAt: null,
    },
  });

  const excludeCredentials: PublicKeyCredentialDescriptorFuture[] =
    existingAuthenticators.map((auth) => ({
      id: Buffer.from(auth.credentialId, 'base64url'),
      type: 'public-key',
      transports: auth.transports as AuthenticatorTransportFuture[],
    }));

  const opts: GenerateRegistrationOptionsOpts = {
    rpName,
    rpID: rpId,
    userID: Buffer.from(user.id),
    userName: user.email,
    userDisplayName: user.name,
    timeout: 60000,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      authenticatorAttachment: requireDeviceBound ? 'platform' : undefined,
      userVerification: 'preferred',
      requireResidentKey: requireDeviceBound,
    },
    supportedAlgorithmIDs: [-7, -257], // ES256, RS256
  };

  const options = await generateRegistrationOptions(opts);

  // Store challenge with TTL (5 minutes)
  const challengeId = Buffer.from(options.challenge).toString('base64url');
  challengeStore.store(
    challengeId,
    options.challenge,
    user.id,
    'registration',
    300 // 5 minutes TTL
  );

  return { options, challengeId };
}

/**
 * Verify registration response and store authenticator
 */
export async function verifyRegistrationResponseForUser(
  user: WebAuthnUser,
  response: any,
  challengeId: string,
  authenticatorName: string
): Promise<{ success: boolean; authenticatorId?: string; error?: string }> {
  const { rpId, origin } = getRPConfig();

  // Retrieve challenge from store
  const challengeData = challengeStore.retrieve(challengeId);
  if (!challengeData) {
    return { success: false, error: 'Challenge expired or invalid' };
  }

  // Verify challenge belongs to this user
  if (challengeData.userId !== user.id) {
    return { success: false, error: 'Challenge user mismatch' };
  }

  if (challengeData.type !== 'registration') {
    return { success: false, error: 'Invalid challenge type' };
  }

  const opts: VerifyRegistrationResponseOpts = {
    response,
    expectedChallenge: challengeData.challenge,
    expectedOrigin: origin,
    expectedRPID: rpId,
    requireUserVerification: true,
  };

  try {
    const verification = await verifyRegistrationResponse(opts);

    if (!verification.verified || !verification.registrationInfo) {
      return { success: false, error: 'Registration verification failed' };
    }

    const { credentialID, credentialPublicKey, counter, aaguid } =
      verification.registrationInfo;

    // Determine if this is a device-bound authenticator (AAL3 requirement)
    // Platform authenticators are typically device-bound
    const deviceBound =
      response.response.authenticatorAttachment === 'platform';

    // Store authenticator in database
    const authenticator = await prisma.webAuthnAuthenticator.create({
      data: {
        userId: user.id,
        credentialId: Buffer.from(credentialID).toString('base64url'),
        publicKey: Buffer.from(credentialPublicKey).toString('base64url'),
        counter,
        name: authenticatorName,
        deviceBound,
        transports: response.response.transports || [],
        aaguid: aaguid ? Buffer.from(aaguid).toString('hex') : null,
      },
    });

    return { success: true, authenticatorId: authenticator.id };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Registration verification error',
    };
  }
}

/**
 * Generate authentication options for WebAuthn login
 */
export async function generateAuthenticationOptionsForUser(
  user: WebAuthnUser
): Promise<AuthenticationChallenge> {
  const { rpId } = getRPConfig();

  // Get user's active authenticators
  const authenticators = await prisma.webAuthnAuthenticator.findMany({
    where: {
      userId: user.id,
      revokedAt: null,
    },
  });

  if (authenticators.length === 0) {
    throw new Error('No authenticators found for user');
  }

  const allowCredentials: PublicKeyCredentialDescriptorFuture[] =
    authenticators.map((auth) => ({
      id: Buffer.from(auth.credentialId, 'base64url'),
      type: 'public-key',
      transports: auth.transports as AuthenticatorTransportFuture[],
    }));

  const opts: GenerateAuthenticationOptionsOpts = {
    rpID: rpId,
    timeout: 60000,
    allowCredentials,
    userVerification: 'preferred',
  };

  const options = await generateAuthenticationOptions(opts);

  // Store challenge with TTL (5 minutes)
  const challengeId = Buffer.from(options.challenge).toString('base64url');
  challengeStore.store(
    challengeId,
    options.challenge,
    user.id,
    'authentication',
    300 // 5 minutes TTL
  );

  return { options, challengeId };
}

/**
 * Verify authentication response
 */
export async function verifyAuthenticationResponseForUser(
  user: WebAuthnUser,
  response: any,
  challengeId: string
): Promise<{ success: boolean; authenticatorId?: string; error?: string }> {
  const { rpId, origin } = getRPConfig();

  // Find the authenticator being used
  const credentialId = Buffer.from(response.id, 'base64url').toString(
    'base64url'
  );
  const authenticator = await prisma.webAuthnAuthenticator.findUnique({
    where: { credentialId },
  });

  if (!authenticator || authenticator.userId !== user.id) {
    return { success: false, error: 'Authenticator not found' };
  }

  if (authenticator.revokedAt) {
    return { success: false, error: 'Authenticator has been revoked' };
  }

  // Retrieve challenge from store
  const challengeData = challengeStore.retrieve(challengeId);
  if (!challengeData) {
    return { success: false, error: 'Challenge expired or invalid' };
  }

  // Verify challenge belongs to this user
  if (challengeData.userId !== user.id) {
    return { success: false, error: 'Challenge user mismatch' };
  }

  if (challengeData.type !== 'authentication') {
    return { success: false, error: 'Invalid challenge type' };
  }

  const opts: VerifyAuthenticationResponseOpts = {
    response,
    expectedChallenge: challengeData.challenge,
    expectedOrigin: origin,
    expectedRPID: rpId,
    credential: {
      id: Buffer.from(authenticator.credentialId, 'base64url'),
      publicKey: Buffer.from(authenticator.publicKey, 'base64url'),
      counter: authenticator.counter,
    },
    requireUserVerification: true,
  };

  try {
    const verification = await verifyAuthenticationResponse(opts);

    if (!verification.verified) {
      return { success: false, error: 'Authentication verification failed' };
    }

    // Update authenticator counter and last used timestamp
    await prisma.webAuthnAuthenticator.update({
      where: { id: authenticator.id },
      data: {
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      },
    });

    return { success: true, authenticatorId: authenticator.id };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Authentication verification error',
    };
  }
}

