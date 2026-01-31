'use client';

/**
 * ANTIGRAVITY-COMPLIANT VERIFICATION
 *
 * This page performs exactly ONE action:
 * Verify canonical Recognition → Acceptance → Start attestation
 *
 * DELETED (per ANTIGRAVITY.md):
 * - Re-check polling (repeated re-verification)
 * - Manual credential ID entry (exploratory verification)
 * - Privacy mode selection (complexity without unblocking)
 * - Revocation timeline viewer (secondary inspection)
 * - Multiple action buttons (Check Status vs Verify)
 *
 * The only valid entry: canonical path token
 * Any non-canonical input must fail.
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { EmploymentVerificationPath } from '@domain-common/employmentContracts';
import { assertCanonicalPathValid, CanonicalPathViolation } from '@domain-common/employmentGuards';
import { AlertTriangle, CheckCircle, Loader2, Shield, XCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface VerificationResult {
  status: 'valid' | 'revoked' | 'unknown';
  credentialId?: string;
  clinicianName?: string;
  credentials?: string;
  npi?: string;
  taxonomy?: string;
  auditRef?: string;
  timestamp: string;
}

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const jwt = searchParams.get('jwt');

    if (!jwt) {
      // No credential to verify - this page should not be visited directly
      setError(
        'No canonical recognition token provided. This page accepts canonical path links only.',
      );
      setLoading(false);
      return;
    }

    verifyCredential(jwt);
  }, [searchParams]);

  const verifyCredential = async (token: string) => {
    setLoading(true);
    setError(null);

    try {
      let jwtData: { credentialId?: string; canonicalPath?: EmploymentVerificationPath } | null =
        null;
      try {
        jwtData = JSON.parse(decodeURIComponent(token));
      } catch {
        throw new Error('Invalid recognition token.');
      }

      if (!jwtData?.canonicalPath) {
        throw new Error(
          'Canonical employment path required (Recognition → Acceptance → Start). This link is incomplete.',
        );
      }

      try {
        assertCanonicalPathValid(jwtData.canonicalPath as EmploymentVerificationPath);
      } catch (error) {
        const message =
          error instanceof CanonicalPathViolation
            ? error.message
            : 'Canonical path validation failed. Recognition, acceptance, and start attestation are required.';
        throw new Error(message);
      }

      const credentialId = jwtData?.credentialId ? String(jwtData.credentialId) : undefined;

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      const response = await fetch(`${backendUrl}/oidc4vp/presentation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vp_token: token,
          canonicalPath: jwtData.canonicalPath,
        }),
      });

      if (!response.ok) {
        throw new Error('Verification failed. Canonical presentation was rejected.');
      }

      const data = await response.json();
      const verified = Boolean(data?.verified ?? true);

      setResult({
        status: verified ? 'valid' : 'unknown',
        credentialId,
        clinicianName: data.holderName,
        credentials: data.credentials,
        npi: data.npi,
        taxonomy: data.taxonomy,
        auditRef: data.auditRef,
        timestamp: data.timestamp ? String(data.timestamp) : new Date().toISOString(),
      });

      if (verified) {
        toast({
          title: 'Canonical Path Verified',
          description: 'Recognition, acceptance, and start attestation verified.',
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      setError(msg);
      toast({
        title: 'Verification Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">VitalCV</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Verify Canonical Path</h1>
          <p className="text-gray-600">
            Recognition, acceptance, and start attestation are required.
          </p>
        </div>

        <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-xl">
          <CardHeader>
            <CardTitle>Canonical Employment Path</CardTitle>
            <CardDescription>Non-canonical inputs are rejected.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="text-center py-8">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600">Verifying recognition...</p>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {result && result.status === 'valid' && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Verified Authority</h3>
                  <p className="text-gray-600">
                    {result.clinicianName || 'Clinician'}
                    {result.credentials ? `, ${result.credentials}` : ''}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  {result.npi && (
                    <div>
                      <strong>NPI:</strong> {result.npi}
                    </div>
                  )}
                  {result.taxonomy && (
                    <div>
                      <strong>Taxonomy:</strong> {result.taxonomy}
                    </div>
                  )}
                  <div>
                    <strong>Verified:</strong> {new Date(result.timestamp).toLocaleString()}
                  </div>
                  {result.auditRef && (
                    <div>
                      <strong>Audit Ref:</strong> <code className="text-xs">{result.auditRef}</code>
                    </div>
                  )}
                </div>

                <p className="text-xs text-center text-gray-500">
                  Canonical path verified. No manual acceptance or start is permitted here.
                </p>
              </div>
            )}

            {result && result.status === 'revoked' && (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Credential Revoked</h3>
                <p className="text-gray-600 mt-2">
                  This recognition has been revoked and cannot be accepted.
                </p>
              </div>
            )}

            {result && result.status === 'unknown' && (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="h-8 w-8 text-yellow-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Unknown Status</h3>
                <p className="text-gray-600 mt-2">Could not determine credential status.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
