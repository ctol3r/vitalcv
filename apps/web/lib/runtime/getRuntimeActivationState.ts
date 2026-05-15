/**
 * getRuntimeActivationState.ts — Operational runtime layer detection.
 *
 * Server-side only — reads process.env.
 * Do NOT import this in client components.
 */

export interface RuntimeActivationState {
  timestamp: string;

  // Clerk
  clerkConfigured: boolean;
  clerkPublishableKeyPresent: boolean;
  clerkSecretKeyPresent: boolean;

  // API base
  apiBaseConfigured: boolean;
  apiBaseValue: string | null; // "configured" or the base URL (localhost only)

  backendBase: string;

  // Database
  databaseUrlConfigured: boolean;

  // Signing
  receiptKeyConfigured: boolean;

  // Environment
  environment: string;
  nodeEnv: string;

  // Overall status
  fullyActivated: boolean;    // all required fields present
  degradedLayers: string[];   // names of layers that are missing

  // Telemetry
  telemetryActive: boolean;   // NEXT_PUBLIC_TELEMETRY_DISABLED !== 'true'

  // Operator summary
  summary: {
    identity: {
      status: 'confirmed' | 'pending';
      label: string;
    };
    readiness: {
      status: 'ready' | 'moving' | 'blocked';
      label: string;
    };
    trust: {
      status: 'operational' | 'partial' | 'degraded';
      label: string;
    };
    headline: string;
    detail: string;
    nextAction: string;
  };
}

function buildSummary(input: {
  clerkConfigured: boolean;
  apiBaseConfigured: boolean;
  databaseUrlConfigured: boolean;
  fullyActivated: boolean;
  degradedLayers: string[];
}): RuntimeActivationState['summary'] {
  const identityConfirmed = input.clerkConfigured;
  const readinessMoving = input.apiBaseConfigured || input.databaseUrlConfigured;
  const identity = {
    status: identityConfirmed ? 'confirmed' as const : 'pending' as const,
    label: identityConfirmed ? 'Identity recognized' : 'Identity pending',
  };
  const readiness = {
    status: input.fullyActivated
      ? 'ready' as const
      : readinessMoving
        ? 'moving' as const
        : 'blocked' as const,
    label: input.fullyActivated
      ? 'Readiness ready'
      : readinessMoving
        ? 'Readiness progressing'
        : 'Readiness blocked',
  };
  const trust = {
    status: input.fullyActivated
      ? 'operational' as const
      : input.degradedLayers.length > 0
        ? 'degraded' as const
        : 'partial' as const,
    label: input.fullyActivated
      ? 'Source-backed'
      : input.degradedLayers.length > 0
        ? 'Review recommended'
        : 'Waiting on sources',
  };

  if (input.fullyActivated) {
    return {
      identity,
      readiness,
      trust,
      headline: 'Ready to proceed',
      detail: 'Identity is recognized, readiness is complete, and source-backed signals are in place.',
      nextAction: 'Proceed to onboarding.',
    };
  }

  if (identityConfirmed) {
    return {
      identity,
      readiness,
      trust,
      headline: 'Identity recognized',
      detail: 'Readiness is progressing.',
      nextAction: input.degradedLayers.length > 0
        ? 'Review recommended.'
        : 'Waiting on sources.',
    };
  }

  return {
    identity,
    readiness,
    trust,
    headline: 'Identity pending',
    detail: 'Identity is still being confirmed.',
    nextAction: 'Set up identity first.',
  };
}

export function getRuntimeActivationState(): RuntimeActivationState {
  const clerkPublishableKeyPresent = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const clerkSecretKeyPresent = !!process.env.CLERK_SECRET_KEY;
  const clerkConfigured = clerkPublishableKeyPresent && clerkSecretKeyPresent;

  const apiBaseConfigured = !!(
    process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE
  );

  const rawApiBase = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || null;
  // Expose localhost URLs as-is for operator visibility; redact production URLs
  let apiBaseValue: string | null = null;
  if (apiBaseConfigured && rawApiBase) {
    if (rawApiBase.includes('localhost') || rawApiBase.includes('127.0.0.1')) {
      apiBaseValue = rawApiBase;
    } else {
      apiBaseValue = 'configured';
    }
  }

  const backendBase = rawApiBase ?? 'http://localhost:4000';

  const databaseUrlConfigured = !!process.env.DATABASE_URL;
  const receiptKeyConfigured = !!process.env.RECEIPT_PRIVATE_KEY_JWK;

  const fullyActivated = clerkConfigured && apiBaseConfigured && databaseUrlConfigured;

  const degradedLayers: string[] = [];
  if (!clerkConfigured) degradedLayers.push('clerk_auth');
  if (!clerkPublishableKeyPresent) degradedLayers.push('clerk_publishable_key');
  if (!clerkSecretKeyPresent) degradedLayers.push('clerk_secret_key');
  if (!apiBaseConfigured) degradedLayers.push('api_base');
  if (!databaseUrlConfigured) degradedLayers.push('database_url');
  if (!receiptKeyConfigured) degradedLayers.push('receipt_signing');

  const telemetryActive = process.env.NEXT_PUBLIC_TELEMETRY_DISABLED !== 'true';
  const summary = buildSummary({
    clerkConfigured,
    apiBaseConfigured,
    databaseUrlConfigured,
    fullyActivated,
    degradedLayers,
  });

  return {
    timestamp: new Date().toISOString(),

    clerkConfigured,
    clerkPublishableKeyPresent,
    clerkSecretKeyPresent,

    apiBaseConfigured,
    apiBaseValue,
    backendBase,

    databaseUrlConfigured,
    receiptKeyConfigured,

    environment: process.env.NODE_ENV ?? 'unknown',
    nodeEnv: process.env.NODE_ENV ?? 'unknown',

    fullyActivated,
    degradedLayers,

    telemetryActive,
    summary,
  };
}
