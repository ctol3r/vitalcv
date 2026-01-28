'use client';

/**
 * ANTIGRAVITY-COMPLIANT ONBOARDING
 *
 * This page performs exactly ONE irreversible action:
 * NPI → NPPES Verification → Recognition Event
 *
 * DELETED (per ANTIGRAVITY.md):
 * - Multi-step wizard (was 3 steps)
 * - Manual entry fallback (created parallel unverified path)
 * - Optional World ID (optional features are gravity)
 * - Edit buttons (re-entry of verified facts)
 *
 * If NPPES lookup fails, the clinician is BLOCKED.
 * VitalCV does not create unverified parallel paths.
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Loader2, Shield, XCircle } from 'lucide-react';
import { useState } from 'react';

interface NPIVerificationResult {
  npi: string;
  name: string;
  credentials: string;
  primaryTaxonomy: string;
  status: string;
  recognitionId?: string;
}

export default function OnboardingPage() {
  const { toast } = useToast();

  const [npi, setNpi] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<NPIVerificationResult | null>(null);

  /**
   * Single action: Verify NPI via NPPES and issue recognition.
   * No fallback. No manual entry. No optional steps.
   */
  const handleVerifyAndRecognize = async () => {
    if (!npi.trim() || npi.length !== 10) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/clinician/npi-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npi: npi.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // NO MANUAL FALLBACK - if NPPES fails, clinician is blocked
        throw new Error(
          errorData.error || 'NPI verification failed. Cannot proceed without verified identity.',
        );
      }

      const data = await response.json();

      setVerified({
        npi: data.npiData.npi,
        name: data.npiData.name,
        credentials: data.npiData.credentials,
        primaryTaxonomy: data.npiData.primaryTaxonomy,
        status: data.npiData.status,
        recognitionId: data.recognitionId,
      });

      toast({
        title: 'VitalCV Recognition Issued',
        description: 'Your verified professional authority is now portable.',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      setError(msg);
      toast({
        title: 'Verification Blocked',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center">
      <div className="w-full max-w-md px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-2 mb-6">
            <Shield className="h-10 w-10 text-blue-600" />
            <span className="text-3xl font-bold text-gray-900">VitalCV</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Verify Your Identity</h1>
          <p className="text-gray-600 mt-2">Enter your NPI to receive VitalCV Recognition</p>
        </div>

        {!verified ? (
          <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-xl">
            <CardHeader>
              <CardTitle>National Provider Identifier</CardTitle>
              <CardDescription>
                Your 10-digit NPI will be verified against the NPPES registry
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="npi">NPI Number</Label>
                <Input
                  id="npi"
                  type="text"
                  placeholder="Enter your 10-digit NPI"
                  value={npi}
                  onChange={(e) => setNpi(e.target.value.replace(/\D/g, ''))}
                  maxLength={10}
                  className="mt-1 text-lg font-mono tracking-wider"
                  disabled={loading}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    {error}
                    <p className="mt-2 text-xs">
                      VitalCV requires verified identity. Contact support if your NPI cannot be
                      verified.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleVerifyAndRecognize}
                disabled={loading || npi.length !== 10}
                className="w-full h-12 text-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Verifying via NPPES...
                  </>
                ) : (
                  'Verify & Receive Recognition'
                )}
              </Button>

              <p className="text-xs text-center text-gray-500">
                By proceeding, your NPI will be verified against the National Plan and Provider
                Enumeration System. No manual entry is permitted.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-xl">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Recognition Issued</h2>
              <p className="text-gray-600 mb-6">
                {verified.name}, {verified.credentials}
              </p>
              <div className="bg-gray-50 rounded-lg p-4 text-left space-y-2 text-sm">
                <div>
                  <strong>NPI:</strong> {verified.npi}
                </div>
                <div>
                  <strong>Taxonomy:</strong> {verified.primaryTaxonomy}
                </div>
                <div>
                  <strong>Status:</strong> {verified.status}
                </div>
                {verified.recognitionId && (
                  <div>
                    <strong>Recognition ID:</strong>{' '}
                    <code className="text-xs">{verified.recognitionId}</code>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-6">Redirecting to your workspace...</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
