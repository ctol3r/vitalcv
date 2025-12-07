'use client';

export const runtime = 'edge';

import { ClaimStatusChip } from '@/components/ClaimStatusChip';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { ApiErrorBoundary } from '@/components/ErrorBoundary';
import { RevocationTimeline } from '@/components/RevocationTimeline';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { VerifyResult } from '@/components/VerifyResult';
import { SdResultPanel } from '@/components/verification/SdResultPanel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSession } from '@/contexts/SessionContext';
import { useToast } from '@/hooks/use-toast';
import { addEvent } from '@/lib/event-cache';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  Loader2,
  Search,
  Shield,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

interface VerificationResult {
  status: 'valid' | 'revoked' | 'unknown' | 'partial';
  credentialId: string;
  auditRef?: string;
  timestamp?: string;
  claimLevel?: number;
  details?: {
    issuer?: string;
    issuedDate?: string;
    expiryDate?: string;
    reason?: string;
    disclosureType?: string;
  };
  disclosedFields?: Record<string, any>;
  undisclosedFields?: string[];
  chainAnchor?: {
    txId: string;
    explorerUrl?: string;
  };
}

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { session } = useSession();
  const [credentialId, setCredentialId] = useState('');
  const [sdJwt, setSdJwt] = useState('');
  const [nonce, setNonce] = useState('');
  const [audience, setAudience] = useState('vitalcv.com');
  const [privacyMode, setPrivacyMode] = useState<'plain' | 'bbs' | 'zk'>('plain');
  const [disclosureLevel, setDisclosureLevel] = useState<'minimum' | 'medium' | 'full'>('minimum');
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRechecking, setIsRechecking] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);
  const [hasAutoVerified, setHasAutoVerified] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [estimatedBytes, setEstimatedBytes] = useState<number>(0);
  const [disclosedFieldsOpen, setDisclosedFieldsOpen] = useState(false);
  const [proofViewerOpen, setProofViewerOpen] = useState(false);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef(0);
  const { toast } = useToast();

  useEffect(() => {
    setNonce(Math.random().toString(36).substring(2, 15));
  }, []);

  // Prefetch graph hints if user is logged in
  useEffect(() => {
    if (!session) return;

    const fetchGraphHints = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const headers: any = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/graph/hints', { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.hints && data.hints.likelyNextCredentials) {
             data.hints.likelyNextCredentials.forEach((node: any) => {
                 const parts = node.id.split(':');
                 const id = parts.length > 1 ? parts[parts.length - 1] : node.id;
                 // Prefetch verification result pages if applicable
                 router.prefetch(`/verify?jwt=${id}`);
             });
          }
        }
      } catch (e) {
        console.error('Failed to fetch graph hints', e);
      }
    };
    fetchGraphHints();
  }, [session, router]);

  // Calculate estimated byte size based on privacy mode and credential ID
  useEffect(() => {
    if (!credentialId.trim()) {
      setEstimatedBytes(0);
      return;
    }

    // Estimate presentation size based on privacy mode
    // These are rough estimates for different formats
    const baseSize = credentialId.length + nonce.length + audience.length + sdJwt.length;
    let formatMultiplier = 1;

    switch (privacyMode) {
      case 'plain':
        // SD-JWT: Base credential + disclosures
        formatMultiplier = 1.5;
        break;
      case 'bbs':
        // BBS+ selective disclosure: Base + selective disclosure proofs
        formatMultiplier = 2.5;
        break;
      case 'zk':
        // Zero-knowledge proof: Base + ZK proof (largest)
        formatMultiplier = 3.5;
        break;
    }

    const estimated = Math.round(baseSize * formatMultiplier);
    setEstimatedBytes(estimated);
  }, [credentialId, nonce, audience, privacyMode, sdJwt]);

  // Get format badge label and color (B123B-FE-003)
  const getFormatBadge = () => {
    switch (privacyMode) {
      case 'plain':
        return {
          label: 'SD-JWT',
          color: 'bg-blue-100 text-blue-800 border-blue-300',
          description: 'Selective Disclosure JWT (SD-JWT)',
        };
      case 'bbs':
        return {
          label: 'BBS+',
          color: 'bg-purple-100 text-purple-800 border-purple-300',
          description: 'BBS+ Selective Disclosure',
        };
      case 'zk':
        return {
          label: 'CSD-JWT',
          color: 'bg-green-100 text-green-800 border-green-300',
          description: 'Compact Selective Disclosure JWT (CSD-JWT)',
        };
      default:
        return {
          label: 'SD-JWT',
          color: 'bg-blue-100 text-blue-800 border-blue-300',
          description: 'Selective Disclosure JWT (SD-JWT)',
        };
    }
  };

  // Format bytes for display
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

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
          if (jwtData.sdJwt) setSdJwt(jwtData.sdJwt);
          // Auto-verify the credential
          handleAutoVerify(jwtData.credentialId, jwtData.sdJwt);
          return;
        }
      } catch {
        // If not JSON, treat as direct JWT/credential ID
        setCredentialId(jwt);
        handleAutoVerify(jwt);
      }
    }
  }, [searchParams, hasAutoVerified]);

  const handleAutoVerify = async (credentialId: string, autoSdJwt?: string) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      const response = await fetch(`${backendUrl}/api/verify/presentation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credentialId: credentialId.trim(),
          sd_jwt: autoSdJwt || sdJwt,
          nonce: nonce.trim(),
          audience: audience.trim(),
          privacyMode: privacyMode !== 'plain',
          disclosureType: privacyMode,
          disclosureLevel: disclosureLevel, // Added
        }),
      });

      if (!response.ok) {
        throw new Error(`Verification failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      const verificationResult: VerificationResult = {
        status: data.status || (data.valid ? 'valid' : 'unknown'),
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
        disclosedFields: data.disclosedFields,
        undisclosedFields: data.undisclosedFields,
        chainAnchor: data.chainAnchor,
      };

      setResult(verificationResult);
      setLastCheckTime(new Date());

      // Add verification event to cache
      addEvent({
        credentialId: credentialId.trim(),
        type: 'verified',
        timestamp: new Date().toISOString(),
        auditRef: data.auditRef,
        details: {
          issuer: data.issuer,
          status: verificationResult.status,
          reason: data.reason,
        },
      });

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
      const response = await fetch(`${backendUrl}/api/verify/presentation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credentialId: result.credentialId,
          sd_jwt: sdJwt,
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
        status: data.status || (data.valid ? 'valid' : 'unknown'),
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

      // Add verification event to cache
      addEvent({
        credentialId: result.credentialId,
        type: 'verified',
        timestamp: new Date().toISOString(),
        auditRef: data.auditRef,
        details: {
          issuer: data.issuer,
          status: verificationResult.status,
          reason: data.reason,
        },
      });

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
  }, [result?.credentialId, nonce, audience, privacyMode, sdJwt, toast]);

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
        `${backendUrl}/api/verify/credential/${encodeURIComponent(credentialId.trim())}/status`,
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
      const response = await fetch(`${backendUrl}/api/verify/presentation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credentialId: credentialId.trim(),
          sd_jwt: sdJwt,
          nonce: nonce.trim(),
          audience: audience.trim(),
          privacyMode: privacyMode !== 'plain',
          disclosureType: privacyMode,
          disclosureLevel: disclosureLevel, // Added
        }),
      });

      if (!response.ok) {
        throw new Error(`Verification failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      const verificationResult: VerificationResult = {
        status: data.status || (data.valid ? 'valid' : 'unknown'),
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
        disclosedFields: data.disclosedFields,
        undisclosedFields: data.undisclosedFields,
        chainAnchor: data.chainAnchor,
      };

      setResult(verificationResult);
      setLastCheckTime(new Date());

      // Add verification event to cache
      addEvent({
        credentialId: credentialId.trim(),
        type: 'verified',
        timestamp: new Date().toISOString(),
        auditRef: data.auditRef,
        details: {
          issuer: data.issuer,
          status: verificationResult.status,
          reason: data.reason,
        },
      });

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
            {session && session.roles.length > 1 && <RoleSwitcher availableRoles={session.roles} />}
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

                <div>
                  <Label htmlFor="sdJwt">SD-JWT Proof (Optional)</Label>
                  <Textarea
                    id="sdJwt"
                    placeholder="Paste SD-JWT here..."
                    value={sdJwt}
                    onChange={(e) => setSdJwt(e.target.value)}
                    className="mt-1 font-mono text-xs"
                    rows={4}
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

                <div className="space-y-4 pt-2">
                  <div>
                    <Label className="mb-2 block">Disclosure Level</Label>
                    <Select value={disclosureLevel} onValueChange={(val: any) => setDisclosureLevel(val)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                         <SelectItem value="minimum">Minimum necessary (License Status Only)</SelectItem>
                         <SelectItem value="medium">Medium disclosure (Identity Minimal)</SelectItem>
                         <SelectItem value="full">Full disclosure (Job Eligibility)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Selects the proof request template for verification
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="privacyMode">Privacy Mode</Label>
                    {credentialId.trim() && (
                      <div className="flex items-center gap-2 text-sm">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className={`font-mono ${getFormatBadge().color} border`}
                            >
                              {getFormatBadge().label}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">{getFormatBadge().description}</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-muted-foreground flex items-center gap-1 cursor-help">
                              <FileText className="h-3 w-3" />~{formatBytes(estimatedBytes)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">
                              Estimated presentation size based on {getFormatBadge().description}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </div>
                  <Select
                    value={privacyMode}
                    onValueChange={(value: 'plain' | 'bbs' | 'zk') => setPrivacyMode(value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plain">Plain - Full disclosure (SD)</SelectItem>
                      <SelectItem value="bbs">BBS+ - Selective disclosure</SelectItem>
                      <SelectItem value="zk">ZK - Zero-knowledge proof (CSD)</SelectItem>
                    </SelectContent>
                  </Select>
                  {credentialId.trim() && (
                    <div className="flex items-center gap-2 mt-2 p-2 bg-muted/50 rounded-md">
                      <Badge
                        variant="outline"
                        className={`text-xs ${getFormatBadge().color} border`}
                      >
                        {getFormatBadge().label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Estimated size:{' '}
                        <strong className="font-mono">{formatBytes(estimatedBytes)}</strong>
                      </span>
                    </div>
                  )}
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
                  <ApiErrorBoundary>
                    {/* Minimum Necessary Mode Badge */}
                    {privacyMode === 'plain' && sdJwt && (
                      <div className="mb-4 flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                            Minimum Necessary Mode Active
                          </span>
                        </div>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          SD-JWT
                        </Badge>
                      </div>
                    )}

                    {result.claimLevel !== undefined && result.claimLevel > 0 && (
                      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                            Claim Level:
                          </span>
                          <ClaimStatusChip
                            level={result.claimLevel as 0 | 1 | 2 | 3}
                            showLabel={true}
                          />
                        </div>
                      </div>
                    )}
                    <VerifyResult
                      result={result}
                      onRecheck={handleRecheck}
                      isRechecking={isRechecking}
                      lastCheckTime={lastCheckTime}
                    />

                    {/* SD Presentation Results Panel */}
                    {result.disclosedFields && (
                       <SdResultPanel
                         disclosedFields={result.disclosedFields}
                         undisclosedFields={result.undisclosedFields}
                         chainAnchor={result.chainAnchor}
                         timestamp={result.timestamp}
                         issuerName={result.details?.issuer}
                         className="mt-4"
                       />
                    )}

                    {/* Collapsible Disclosed Fields Panel (Legacy/Detailed View) */}
                    {sdJwt && !result.disclosedFields && (
                      <div className="mt-4 border rounded-lg overflow-hidden">
                        <button
                          onClick={() => setDisclosedFieldsOpen(!disclosedFieldsOpen)}
                          className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium"
                        >
                          <span>Disclosed Fields</span>
                          {disclosedFieldsOpen ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                        {disclosedFieldsOpen && (
                          <div className="p-3 bg-white border-t text-sm text-gray-600 space-y-2">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span>license_status</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span>issuer</span>
                            </div>
                            {/* Mocking other fields for demo */}
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span>expiry_date</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SD-JWT Proof Viewer */}
                    {sdJwt && (
                      <div className="mt-4 border rounded-lg overflow-hidden">
                        <button
                          onClick={() => setProofViewerOpen(!proofViewerOpen)}
                          className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium"
                        >
                          <span className="flex items-center gap-2">
                            <Eye className="h-4 w-4" /> SD-JWT Proof
                          </span>
                          {proofViewerOpen ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                        {proofViewerOpen && (
                          <div className="p-3 bg-gray-900 text-green-400 font-mono text-xs overflow-x-auto">
                            <pre>{sdJwt}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </ApiErrorBoundary>
                )}

                {/* Revocation Timeline */}
                {result && (
                  <RevocationTimeline
                    credentialId={result.credentialId}
                    isOpen={timelineOpen}
                    onToggle={() => setTimelineOpen(!timelineOpen)}
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
