'use client';

import { DarkModeToggle } from '@/components/DarkModeToggle';
import { VerifyResult } from '@/components/VerifyResult';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Loader2, Search, Shield, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

interface VerificationResult {
  status: 'valid' | 'revoked' | 'unknown';
  credentialId: string;
  auditRef?: string;
  details?: {
    issuer?: string;
    issuedDate?: string;
    expiryDate?: string;
    reason?: string;
    disclosureType?: string;
  };
}

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const [credentialId, setCredentialId] = useState('');
  const [nonce, setNonce] = useState('');
  const [audience, setAudience] = useState('vitalcv.com');
  const [privacyMode, setPrivacyMode] = useState<'plain' | 'bbs' | 'zk'>('plain');
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRechecking, setIsRechecking] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);
  const [hasAutoVerified, setHasAutoVerified] = useState(false);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef(0);
  const { toast } = useToast();

  useEffect(() => {
    setNonce(Math.random().toString(36).substring(2, 15));
  }, []);

  // Auto-verify JWT from query params with React StrictMode guard
  useEffect(() => {
    const jwt = searchParams.get('jwt');
    if (jwt && !hasAutoVerified) {
      setHasAutoVerified(true);

      try {
        // Try to parse as JSON first (for share URLs)
        const jwtData = JSON.parse(decodeURIComponent(jwt));
        if (jwtData.credentialId) {
          setCredentialId(jwtData.credentialId);
          // Auto-verify the credential
          handleAutoVerify(jwtData.credentialId);
          return;
        }
      } catch {
        // If not JSON, treat as direct JWT/credential ID
        setCredentialId(jwt);
        handleAutoVerify(jwt);
      }
    }
  }, [searchParams, hasAutoVerified]);

  const handleAutoVerify = async (credentialId: string) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      const response = await fetch(`${backendUrl}/verifier/presentation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credentialId: credentialId.trim(),
          nonce: nonce.trim(),
          audience: audience.trim(),
          privacyMode: privacyMode !== 'plain',
          disclosureType: privacyMode,
        }),
      });

      if (!response.ok) {
        throw new Error(`Verification failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      const verificationResult: VerificationResult = {
        status: data.valid ? 'valid' : data.status || 'unknown',
        credentialId: credentialId.trim(),
        auditRef: data.auditRef,
        timestamp: new Date().toISOString(),
        details: {
          issuer: data.issuer,
          issuedDate: data.issuedDate,
          expiryDate: data.expiryDate,
          reason: data.reason,
          disclosureType:
            privacyMode === 'plain'
              ? 'Full disclosure'
              : privacyMode === 'bbs'
              ? 'BBS+ selective disclosure'
              : 'Zero-knowledge proof',
        },
      };

      setResult(verificationResult);
      setLastCheckTime(new Date());

      toast({
        title: 'Auto-Verification Complete',
        description: `Credential ${
          verificationResult.status === 'valid' ? 'verified successfully' : 'verification completed'
        }`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to auto-verify credential.';
      setError(errorMessage);

      toast({
        title: 'Auto-Verification Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecheck = useCallback(async () => {
    if (!result?.credentialId) return;

    setIsRechecking(true);
    setError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      const response = await fetch(`${backendUrl}/verifier/presentation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credentialId: result.credentialId,
          nonce: nonce.trim(),
          audience: audience.trim(),
          privacyMode: privacyMode !== 'plain',
          disclosureType: privacyMode,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Re-check failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      const verificationResult: VerificationResult = {
        status: data.valid ? 'valid' : data.status || 'unknown',
        credentialId: result.credentialId,
        auditRef: data.auditRef,
        timestamp: new Date().toISOString(),
        details: {
          issuer: data.issuer,
          issuedDate: data.issuedDate,
          expiryDate: data.expiryDate,
          reason: data.reason,
          disclosureType:
            privacyMode === 'plain'
              ? 'Full disclosure'
              : privacyMode === 'bbs'
              ? 'BBS+ selective disclosure'
              : 'Zero-knowledge proof',
        },
      };

      setResult(verificationResult);
      setLastCheckTime(new Date());

      toast({
        title: 'Status Updated',
        description: `Credential status: ${verificationResult.status}`,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to re-check credential status.';
      setError(errorMessage);

      toast({
        title: 'Re-check Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsRechecking(false);
    }
  }, [result?.credentialId, nonce, audience, privacyMode, toast]);

  const startPolling = useCallback(() => {
    if (!result?.credentialId) return;

    pollCountRef.current = 0;
    const pollInterval = 1000;
    const maxPolls = 5;

    const poll = () => {
      pollCountRef.current++;
      if (pollCountRef.current <= maxPolls) {
        handleRecheck();
        pollTimeoutRef.current = setTimeout(poll, pollInterval);
      }
    };

    poll();
  }, [result?.credentialId, handleRecheck]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && result) {
        startPolling();
      } else {
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
          pollTimeoutRef.current = null;
        }
        pollCountRef.current = 0;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [result, startPolling]);

  const handleCheckStatus = async () => {
    if (!credentialId.trim()) return;

    setStatusLoading(true);
    setError(null);
    setResult(null);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      const response = await fetch(
        `${backendUrl}/verifier/credential/${encodeURIComponent(credentialId.trim())}/status`,
      );

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      const statusResult: VerificationResult = {
        status: data.status || 'unknown',
        credentialId: credentialId.trim(),
        auditRef: data.auditRef,
        timestamp: new Date().toISOString(),
        details: {
          issuer: data.issuer,
          issuedDate: data.issuedDate,
          expiryDate: data.expiryDate,
          reason: data.reason,
        },
      };

      setResult(statusResult);

      toast({
        title: 'Status Check Complete',
        description: `Credential status: ${statusResult.status}`,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to check credential status. Please try again.';
      setError(errorMessage);

      toast({
        title: 'Status Check Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setStatusLoading(false);
    }
  };

  const handleVerifyPresentation = async () => {
    if (!credentialId.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      const response = await fetch(`${backendUrl}/verifier/presentation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credentialId: credentialId.trim(),
          nonce: nonce.trim(),
          audience: audience.trim(),
          privacyMode: privacyMode !== 'plain',
          disclosureType: privacyMode,
        }),
      });

      if (!response.ok) {
        throw new Error(`Verification failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      const verificationResult: VerificationResult = {
        status: data.valid ? 'valid' : data.status || 'unknown',
        credentialId: credentialId.trim(),
        auditRef: data.auditRef,
        timestamp: new Date().toISOString(),
        details: {
          issuer: data.issuer,
          issuedDate: data.issuedDate,
          expiryDate: data.expiryDate,
          reason: data.reason,
          disclosureType:
            privacyMode === 'plain'
              ? 'Full disclosure'
              : privacyMode === 'bbs'
              ? 'BBS+ selective disclosure'
              : 'Zero-knowledge proof',
        },
      };

      setResult(verificationResult);
      setLastCheckTime(new Date());

      toast({
        title: 'Verification Complete',
        description: `Credential ${
          verificationResult.status === 'valid' ? 'verified successfully' : 'verification completed'
        }`,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to verify credential. Please try again.';
      setError(errorMessage);

      toast({
        title: 'Verification Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Skip to main content */}
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>

      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">VitalCV</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/issuer" className="text-gray-600 hover:text-blue-600 transition-colors">
              Issuer
            </Link>
            <Link href="/wallet" className="text-gray-600 hover:text-blue-600 transition-colors">
              Wallet
            </Link>
            <Link href="/analytics" className="text-gray-600 hover:text-blue-600 transition-colors">
              Analytics
            </Link>
            <Link href="/support" className="text-gray-600 hover:text-blue-600 transition-colors">
              Support
            </Link>
            <DarkModeToggle />
          </nav>
        </div>
      </header>

      <main id="main-content" className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Verify Credential</h1>
          <p className="text-lg text-gray-600">
            Enter a credential ID to verify its authenticity and status
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
          {/* Left Form Section */}
          <div className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Credential Verification</CardTitle>
                <CardDescription>
                  Enter the credential details below to perform verification
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="credentialId">Credential ID *</Label>
                  <Input
                    id="credentialId"
                    type="text"
                    placeholder="Enter credential ID (e.g., CRED-12345)"
                    value={credentialId}
                    onChange={(e) => setCredentialId(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nonce">Nonce (Auto-generated)</Label>
                    <Input
                      id="nonce"
                      type="text"
                      placeholder="Auto-generated nonce"
                      value={nonce}
                      onChange={(e) => setNonce(e.target.value)}
                      className="mt-1 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="audience">Audience</Label>
                    <Input
                      id="audience"
                      type="text"
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="privacyMode">Privacy Mode</Label>
                  <Select
                    value={privacyMode}
                    onValueChange={(value: 'plain' | 'bbs' | 'zk') => setPrivacyMode(value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plain">Plain - Full disclosure</SelectItem>
                      <SelectItem value="bbs">BBS+ - Selective disclosure</SelectItem>
                      <SelectItem value="zk">ZK - Zero-knowledge proof</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    onClick={handleCheckStatus}
                    variant="outline"
                    className="flex-1 bg-transparent"
                    disabled={statusLoading || !credentialId.trim()}
                  >
                    {statusLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Check Status
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleVerifyPresentation}
                    className="flex-1"
                    disabled={loading || !credentialId.trim()}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Verify Presentation
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="text-center text-sm text-gray-500">
              <p>
                Try these sample IDs:{' '}
                <code className="bg-gray-100 px-2 py-1 rounded">CRED-12345</code>,
                <code className="bg-gray-100 px-2 py-1 rounded ml-2">CRED-revoked-001</code>,
                <code className="bg-gray-100 px-2 py-1 rounded ml-2">CRED-unknown-999</code>
              </p>
            </div>
          </div>

          {/* Right Result Section */}
          <div className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Verification Result</CardTitle>
                <CardDescription>
                  The result of your credential verification will appear here
                </CardDescription>
              </CardHeader>
              <CardContent>
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {(loading || statusLoading) && !result && (
                  <div className="space-y-4" role="status" aria-live="polite">
                    <div className="sr-only">Verifying credential, please wait...</div>
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-20 w-full" />
                    <div className="flex gap-2">
                      <Skeleton className="h-8 flex-1" />
                      <Skeleton className="h-8 flex-1" />
                    </div>
                  </div>
                )}

                {result && (
                  <VerifyResult
                    result={result}
                    onRecheck={handleRecheck}
                    isRechecking={isRechecking}
                    lastCheckTime={lastCheckTime}
                  />
                )}

                {!result && !loading && !statusLoading && !error && (
                  <div className="text-center py-12 text-gray-500" role="status" aria-live="polite">
                    <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
                    <p>Enter a credential ID and click verify to see results</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
