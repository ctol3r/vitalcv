'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { QRScanner } from '@/components/verifier/QRScanner';
import { CameraPermissionHelp } from '@/components/verifier/CameraPermissionHelp';
import { VerificationErrorOverlay } from '@/components/verifier/VerificationErrorOverlay';
import { VerifierHeader } from '@/components/verification/VerifierHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Activity,
  AlertTriangle,
  Copy,
  Link as LinkIcon,
  Loader2,
  ScanLine,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

type DecodedProof = {
  vpToken: string;
  presentationSubmission?: Record<string, any>;
  nonce?: string;
  statusListUrl?: string;
  requestId?: string;
};

type VerificationResponse = {
  presentationId: string;
  status: 'valid' | 'revoked' | 'invalid';
  valid: boolean;
  issuer: {
    did: string;
    name?: string;
    thumbprint?: string;
  };
  credentialType?: string;
  holder?: {
    subject?: string;
  };
  timestamps: {
    verifiedAt: string;
  };
  chain: {
    anchored: boolean;
    status: string;
    txHash: string;
    blockHash: string;
    blockNumber: number;
    merkleProof: string[];
    network: string;
    timestamp: string;
  };
  revocation: {
    revoked: boolean;
    statusListUrl?: string;
  };
  proofThreadId?: string;
  proofStreamSummary?: {
    status: 'pending' | 'validated' | 'anchored' | 'error';
    eventCount: number;
    lastEvent?: string;
    lastEventAt?: string;
  };
};

const API_BASE = process.env.NEXT_PUBLIC_VERIFIER_API_BASE || '';

export default function ScanPage() {
  const [decoded, setDecoded] = useState<DecodedProof | null>(null);
  const [verification, setVerification] = useState<VerificationResponse | null>(null);
  const [status, setStatus] = useState<'idle' | 'scanned' | 'verifying' | 'complete' | 'error'>(
    'idle',
  );
  const [error, setError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPayload, setManualPayload] = useState('');
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);
  const [errorOverlayOpen, setErrorOverlayOpen] = useState(false);
  const { toast } = useToast();
  const isMobile = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /iphone|ipad|ipod|android/i.test(navigator.userAgent);
  }, []);

  const appClipUrl = useMemo(() => {
    if (!decoded) return null;
    const requestId =
      decoded.requestId ||
      decoded.nonce ||
      (decoded.presentationSubmission as { id?: string })?.id ||
      (decoded.presentationSubmission as { presentationId?: string })?.presentationId;
    const query = requestId ? `?requestId=${encodeURIComponent(requestId)}` : '';
    return `vitalcv://clip/verify${query}`;
  }, [decoded]);

  const handleScan = async (raw: string) => {
    if (!raw) return;
    setError(null);
    setStatus('scanned');
    const parsed = parseQrPayload(raw);
    if (!parsed) {
      setError('QR payload was not a valid verifiable presentation.');
      setStatus('error');
      setErrorOverlayOpen(true);
      return;
    }

    setDecoded(parsed);
    await verifyPresentation(parsed);
  };

  const verifyPresentation = async (payload: DecodedProof) => {
    setStatus('verifying');
    try {
      const response = await fetch(`${API_BASE}/api/verify/presentation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vp_token: payload.vpToken,
          presentation_submission: payload.presentationSubmission,
          metadata: {
            statusListUrl: payload.statusListUrl,
            scannedAt: new Date().toISOString(),
            source: 'portal-scan',
          },
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || 'Verification failed');
      }

      const result = (await response.json()) as VerificationResponse;
      setVerification(result);
      setStatus('complete');
      toast({
        title: 'Verification Complete',
        description: 'Presentation validated successfully.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to verify presentation';
      setError(message);
      setStatus('error');
      setErrorOverlayOpen(true);
    }
  };

  const handleManualSubmit = () => {
    if (!manualPayload.trim()) return;
    handleScan(manualPayload.trim());
  };

  const handleCopyPresentationId = async () => {
    if (!verification?.presentationId) return;
    await navigator.clipboard.writeText(verification.presentationId);
    toast({
      title: 'Copied',
      description: 'Presentation ID copied to clipboard.',
    });
  };

  const validityBadge = useMemo(() => {
    if (!verification) {
      return (
        <Badge variant="outline" className="gap-1">
          <ScanLine className="h-3.5 w-3.5" />
          Awaiting scan
        </Badge>
      );
    }

    if (verification.valid) {
      return (
        <Badge className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">
          <ShieldCheck className="h-3.5 w-3.5" />
          Valid
        </Badge>
      );
    }

    return (
      <Badge className="gap-1 bg-red-100 text-red-700 border-red-200" variant="outline">
        <AlertTriangle className="h-3.5 w-3.5" />
        {verification.status === 'revoked' ? 'Revoked' : 'Invalid'}
      </Badge>
    );
  }, [verification]);

  return (
    <div className="container max-w-6xl py-8">
      <VerifierHeader
        title="Scan & Verify"
        description="Use the verifier camera to ingest wallet-presented credentials with DPoP binding."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Scan Credential QR</CardTitle>
                <CardDescription>Camera feed decodes wallet-presented VP payloads.</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setShowPermissionHelp((prev) => !prev)}
              >
                Camera help
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <QRScanner onScan={handleScan} className="w-full" />

              {isMobile && appClipUrl && (
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={() => openAppClip(appClipUrl)}
                >
                  <Smartphone className="mr-2 h-4 w-4" />
                  Open in App Clip
                </Button>
              )}

              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Need to paste payload manually?</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setManualOpen((prev) => !prev)}
                  >
                    {manualOpen ? 'Hide' : 'Paste payload'}
                  </Button>
                </div>

                {manualOpen && (
                  <div className="space-y-3">
                    <Textarea
                      value={manualPayload}
                      onChange={(event) => setManualPayload(event.target.value)}
                      placeholder="Paste VP token JSON or deep link payload"
                    />
                    <Button onClick={handleManualSubmit} className="w-full">
                      Submit proof
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {decoded && (
            <Card>
              <CardHeader>
                <CardTitle>Decoded Payload</CardTitle>
                <CardDescription>Quick view of the scanned presentation envelope.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Nonce</span>
                  <code className="font-mono bg-muted px-2 py-1 rounded">
                    {decoded.nonce || '—'}
                  </code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status list</span>
                  <code className="font-mono bg-muted px-2 py-1 rounded break-all max-w-[70%] text-right">
                    {decoded.statusListUrl || 'default'}
                  </code>
                </div>
                {decoded.presentationSubmission && (
                  <details className="rounded-md border bg-muted/40 p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Presentation submission
                    </summary>
                    <pre className="mt-2 max-h-48 overflow-auto rounded bg-background p-2 text-xs">
                      {JSON.stringify(decoded.presentationSubmission, null, 2)}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Verification Status</CardTitle>
                {validityBadge}
              </div>
              <CardDescription>
                {status === 'complete'
                  ? 'Presentation verified with issuer keys and StatusList'
                  : 'Waiting for a wallet presentation'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {status === 'verifying' && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running DPoP + JWKS checks...
                </div>
              )}

              {verification ? (
                <>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase">Issuer</span>
                    <p className="font-medium break-all">
                      {verification.issuer.name || verification.issuer.did}
                    </p>
                    <p className="text-xs text-muted-foreground">{verification.issuer.did}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase">Credential type</span>
                    <p className="font-medium">{verification.credentialType || 'Unknown'}</p>
                  </div>

                  <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Presentation ID</p>
                      <p className="font-mono text-xs">{verification.presentationId}</p>
                    </div>
                    <Button variant="outline" size="icon" onClick={handleCopyPresentationId}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button asChild className="flex-1">
                      <Link href={`/proof/${verification.presentationId}`} className="gap-2">
                        <LinkIcon className="h-4 w-4" />
                        Technical proof
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      asChild
                      disabled={!verification.presentationId}
                    >
                      <a
                        href={`/api/verify/export/${verification.presentationId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Download JSON
                      </a>
                    </Button>
                  </div>
                  {verification.proofThreadId && (
                    <Button asChild variant="secondary" className="w-full gap-2">
                      <Link href={`/verifier/stream/${verification.proofThreadId}`}>
                        <Activity className="h-4 w-4" />
                        View proof timeline
                      </Link>
                    </Button>
                  )}
                </>
              ) : (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Scan a wallet QR or paste a payload to start verification.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Chain Status</CardTitle>
              <CardDescription>Track how the verification was anchored.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {verification ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Network</span>
                    <span className="font-medium uppercase">{verification.chain.network}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Block</span>
                    <span className="font-mono text-xs">{verification.chain.blockNumber}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">Block hash</span>
                    <p className="font-mono text-[11px] break-all">
                      {verification.chain.blockHash}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">Merkle proof</span>
                    <div className="mt-1 space-y-1">
                      {verification.chain.merkleProof.map((leaf) => (
                        <p key={leaf} className="font-mono text-[11px] break-all">
                          {leaf}
                        </p>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Chain anchoring will display after a successful verification.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {showPermissionHelp && (
        <div className="mt-6">
          <CameraPermissionHelp onDismiss={() => setShowPermissionHelp(false)} />
        </div>
      )}

      <VerificationErrorOverlay
        open={errorOverlayOpen}
        onOpenChange={setErrorOverlayOpen}
        errorMessage={error ?? undefined}
        errorCode={status === 'error' ? 'verification_failed' : undefined}
      />
    </div>
  );
}

function parseQrPayload(raw: string): DecodedProof | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // JSON payload
  const directJson = safeJsonParse(trimmed);
  if (directJson) {
    const vpToken = directJson.vp_token || directJson.vpToken;
    if (vpToken) {
      return {
        vpToken,
        presentationSubmission:
          directJson.presentation_submission || directJson.presentationSubmission,
        nonce: directJson.nonce,
        statusListUrl: directJson.statusListUrl,
        requestId: extractRequestId(directJson),
      };
    }
  }

  // Base64 encoded JSON
  const decodedBase64 = decodeBase64Json(trimmed);
  if (decodedBase64) {
    const vpToken = decodedBase64.vp_token || decodedBase64.vpToken;
    if (vpToken) {
      return {
        vpToken,
        presentationSubmission:
          decodedBase64.presentation_submission || decodedBase64.presentationSubmission,
        nonce: decodedBase64.nonce,
        statusListUrl: decodedBase64.statusListUrl,
        requestId: extractRequestId(decodedBase64),
      };
    }
  }

  // Deep link / query string
  const queryIndex = trimmed.indexOf('?');
  if (queryIndex !== -1) {
    const query = trimmed.slice(queryIndex + 1);
    const params = new URLSearchParams(query);
    const vpToken = params.get('vp_token');
    const requestIdParam = params.get('requestId') ?? params.get('request_id');
    if (vpToken) {
      return { vpToken, requestId: requestIdParam ?? undefined };
    }

    const request = params.get('request');
    const requestJson = request ? decodeBase64Json(request) : null;
    if (requestJson?.request?.vp_token) {
      return {
        vpToken: requestJson.request.vp_token,
        presentationSubmission: requestJson.request.presentation_submission,
        nonce: requestJson.request.nonce,
        requestId: extractRequestId(requestJson.request) ?? requestIdParam ?? undefined,
      };
    }
  }

  return null;
}

function safeJsonParse(value: string): Record<string, any> | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function decodeBase64Json(value: string): Record<string, any> | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    const decoded = atob(normalized + padding);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function extractRequestId(payload: Record<string, any>): string | undefined {
  if (!payload) return undefined;
  return (
    payload.requestId ||
    payload.request_id ||
    payload.presentationId ||
    payload.presentation_id ||
    payload.presentationSubmissionId ||
    payload.nonce ||
    undefined
  );
}

function openAppClip(url: string) {
  if (typeof window === 'undefined') return;
  window.location.href = url;
}

