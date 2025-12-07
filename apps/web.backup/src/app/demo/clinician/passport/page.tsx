'use client';

import { useCallback, useMemo, useState } from 'react';
import { AlertCircle, DownloadCloud, ShieldCheck, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const FALLBACK_CLINICIAN_ID = 'clinician-demo-001';

interface PageProps {
  searchParams?: {
    clinicianId?: string;
  };
}

export default function PassportDownloadPage({ searchParams }: PageProps) {
  const clinicianId = searchParams?.clinicianId ?? FALLBACK_CLINICIAN_ID;
  const [walletSecret] = useState(() => generateWalletSecret());
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadInfo, setDownloadInfo] = useState<{
    anchorId: string;
    hash: string;
    iv: string;
    tag: string;
  } | null>(null);

  const credentialList = useMemo(
    () => [
      'Portable DID document',
      'Clinician identity VC (CSD-JWT)',
      'Compact participation VC',
      'State license VC',
      'Board certification VC',
      'DEA registration VC',
      'Privilege grant VC',
    ],
    [],
  );

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    setError(null);
    setDownloadInfo(null);

    try {
      const response = await fetch(`/passport/download?clinicianId=${encodeURIComponent(clinicianId)}`, {
        headers: {
          'x-wallet-binding': 'device-bound',
          'x-wallet-secret': walletSecret,
          Accept: 'application/octet-stream',
        },
      });

      if (!response.ok) {
        throw new Error(`API responded with ${response.status}`);
      }

      const blob = await response.blob();
      const iv = response.headers.get('x-passport-iv') ?? '';
      const tag = response.headers.get('x-passport-tag') ?? '';
      const anchorId = response.headers.get('x-passport-anchor-id') ?? 'unknown';
      const hash = response.headers.get('x-passport-hash') ?? 'unknown';
      const filename =
        response.headers
          .get('Content-Disposition')
          ?.split('filename=')[1]
          ?.replace(/["']/g, '') ?? `credential-passport-${clinicianId}.enc`;

      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);

      setDownloadInfo({ anchorId, hash, iv, tag });
    } catch (err) {
      console.error('Passport download failed', err);
      setError(err instanceof Error ? err.message : 'Failed to download credential passport.');
    } finally {
      setDownloading(false);
    }
  }, [clinicianId, walletSecret]);

  const handleCopySecret = useCallback(async () => {
    if (!navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(walletSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }, [walletSecret]);

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-emerald-600" aria-hidden="true" />
          <Badge variant="outline" className="text-xs">
            Device-bound wallets only
          </Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Credential Passport</h1>
        <p className="text-muted-foreground">
          Download an encrypted bundle of verifiable credentials for clinician{' '}
          <span className="font-mono text-sm">{clinicianId}</span>. The file is sealed for the requesting
          wallet and anchored with the issuer key.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-dashed border-red-400/70 bg-red-50 p-4 text-sm text-red-900"
        >
          <AlertCircle className="mt-0.5 h-4 w-4" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" aria-hidden="true" />
              What&apos;s inside
            </CardTitle>
            <CardDescription>Encrypted ZIP with a DID document and seven CSD-JWT credentials.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {credentialList.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">Privacy warning</p>
              <p>
                Only store or forward this bundle inside the device-bound Vital wallet. The payload contains
                license numbers, DEA info, and privilege manifests with selective disclosure hints.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DownloadCloud className="h-5 w-5" aria-hidden="true" />
              Download (device-bound)
            </CardTitle>
            <CardDescription>
              Wallet must present a 32-byte secret to decrypt the response. Each download is uniquely sealed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Wallet secret (base64)</p>
              <code className="block overflow-hidden text-ellipsis rounded-md bg-muted px-3 py-2 text-sm">
                {walletSecret}
              </code>
              <Button variant="secondary" size="sm" onClick={handleCopySecret} aria-live="polite">
                {copied ? 'Copied' : 'Copy secret'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Provide this secret as the <span className="font-mono">x-wallet-secret</span> header. It is only used for
                this download session.
              </p>
            </div>

            <Button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full"
              aria-live="polite"
              aria-label="Download encrypted credential passport"
            >
              <DownloadCloud className={`mr-2 h-4 w-4 ${downloading ? 'animate-spin' : ''}`} aria-hidden="true" />
              {downloading ? 'Preparing bundle…' : 'Download encrypted passport'}
            </Button>

            {downloadInfo && (
              <div
                className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
                aria-live="polite"
              >
                <p className="font-medium">Bundle anchored</p>
                <p>Anchor ID: {downloadInfo.anchorId}</p>
                <p>Bundle hash: {downloadInfo.hash}</p>
                <p>IV: {downloadInfo.iv}</p>
                <p>Auth tag: {downloadInfo.tag}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function generateWalletSecret(): string {
  if (typeof window === 'undefined' || !window.crypto?.getRandomValues) {
    const fallback = randomFallbackBytes(32);
    return bufferToBase64(fallback);
  }

  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return bufferToBase64(bytes);
}

function bufferToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function randomFallbackBytes(length: number) {
  const result = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    result[i] = Math.floor(Math.random() * 256);
  }
  return result;
}

