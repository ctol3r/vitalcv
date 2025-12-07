'use client';

/**
 * Role Guard - Protects routes and components based on user roles and claim level
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useSession } from '@/contexts/SessionContext';
import { UserRole } from '@/lib/npi-types';
import { Lock, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { ReactNode } from 'react';

interface RoleGuardProps {
  children: ReactNode;
  requiredRole?: UserRole;
  requireIssuerAccess?: boolean;
  requireVerifierAccess?: boolean;
  minClaimLevel?: number;
  fallback?: ReactNode;
}

export function RoleGuard({
  children,
  requiredRole,
  requireIssuerAccess = false,
  requireVerifierAccess = false,
  minClaimLevel,
  fallback,
}: RoleGuardProps) {
  const { session, isLoading, hasRole, canAccessIssuer, canAccessVerifier } = useSession();

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if user is authenticated
  if (!session) {
    return (
      fallback || (
        <div className="container max-w-2xl py-12">
          <Alert variant="destructive">
            <Lock className="h-4 w-4" />
            <AlertTitle>Authentication Required</AlertTitle>
            <AlertDescription>You must be signed in to access this page.</AlertDescription>
          </Alert>
          <div className="mt-6 flex gap-3">
            <Link href="/login">
              <Button>Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button variant="outline">Create Account</Button>
            </Link>
          </div>
        </div>
      )
    );
  }

  // Check role requirement
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      fallback || (
        <div className="container max-w-2xl py-12">
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              You don't have the required role ({requiredRole}) to access this page.
            </AlertDescription>
          </Alert>
          <div className="mt-6">
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          </div>
        </div>
      )
    );
  }

  // Check issuer access (requires issuer role + Level 3)
  if (requireIssuerAccess && !canAccessIssuer()) {
    return (
      fallback || (
        <div className="container max-w-2xl py-12">
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Issuer Access Required</AlertTitle>
            <AlertDescription>
              To access issuer features, you need the issuer role and Level 3 claim verification.
              {session.claimLevel < 3 && <> Current claim level: {session.claimLevel}</>}
            </AlertDescription>
          </Alert>
          <div className="mt-6 flex gap-3">
            {session.claimLevel < 3 && (
              <Link href="/start">
                <Button>Verify Your Identity</Button>
              </Link>
            )}
            <Link href="/dashboard">
              <Button variant="outline">Go to Dashboard</Button>
            </Link>
          </div>
        </div>
      )
    );
  }

  // Check verifier access
  if (requireVerifierAccess && !canAccessVerifier()) {
    return (
      fallback || (
        <div className="container max-w-2xl py-12">
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Verifier Access Required</AlertTitle>
            <AlertDescription>You need the verifier role to access this page.</AlertDescription>
          </Alert>
          <div className="mt-6">
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          </div>
        </div>
      )
    );
  }

  // Check minimum claim level
  if (minClaimLevel !== undefined && session.claimLevel < minClaimLevel) {
    return (
      fallback || (
        <div className="container max-w-2xl py-12">
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Higher Verification Level Required</AlertTitle>
            <AlertDescription>
              This feature requires claim level {minClaimLevel} or higher. Your current level is{' '}
              {session.claimLevel}.
            </AlertDescription>
          </Alert>
          <div className="mt-6">
            <Link href="/start">
              <Button>Verify Your Identity</Button>
            </Link>
          </div>
        </div>
      )
    );
  }

  // All checks passed
  return <>{children}</>;
}
