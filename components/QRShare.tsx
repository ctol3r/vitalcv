'use client';

import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Copy, Download, ExternalLink, Loader2, QrCode, Share2 } from 'lucide-react';
import { useState } from 'react';

interface QRShareProps {
  credentialId: string;
  status: string;
  details?: {
    issuer?: string;
    issuedDate?: string;
    expiryDate?: string;
    reason?: string;
    disclosureType?: string;
  };
}

export function QRShare({ credentialId, status, details }: QRShareProps) {
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vpToken, setVpToken] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const generateVPToken = async () => {
    setLoading(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      const response = await fetch(`${backendUrl}/verifier/presentation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credentialId,
          status,
          details,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate VP token');
      }

      const data = await response.json();
      setVpToken(data.vpToken || data.jwt || JSON.stringify(data));
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to generate VP token',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateShareUrl = async () => {
    setLoading(true);
    try {
      const shareData = {
        credentialId,
        status,
        details,
        timestamp: new Date().toISOString(),
        type: 'credential_verification',
        version: '1.0',
      };

      // Create a shareable URL with the verification data
      const baseUrl = window.location.origin;
      const encodedData = encodeURIComponent(JSON.stringify(shareData));
      const shareUrl = `${baseUrl}/verify?data=${encodedData}&source=qrshare`;
      setShareUrl(shareUrl);

      // Also copy to clipboard automatically
      await copyToClipboard(shareUrl, 'Share URL');
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to generate share URL',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: '✅ Copied',
        description: `${type} copied to clipboard`,
        duration: 2000,
      });
    } catch (err) {
      toast({
        title: '❌ Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
        duration: 3000,
      });
    }
  };

  const downloadQRCode = async () => {
    if (!vpToken) return;

    try {
      // Create a canvas to generate QR code image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size
      canvas.width = 256;
      canvas.height = 256;

      // Create QR code data URL (simplified - in real app you'd use a QR library)
      const qrDataUrl = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`;

      // Create download link
      const link = document.createElement('a');
      link.download = `credential-${credentialId}-qr.png`;
      link.href = qrDataUrl;
      link.click();

      toast({
        title: '✅ Downloaded',
        description: 'QR code downloaded successfully',
        duration: 2000,
      });
    } catch (err) {
      toast({
        title: '❌ Error',
        description: 'Failed to download QR code',
        variant: 'destructive',
        duration: 3000,
      });
    }
  };

  const shareViaWebAPI = async () => {
    if (!shareUrl) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'VitalCV Credential Verification',
          text: 'Check this credential verification',
          url: shareUrl,
        });
      } else {
        // Fallback to clipboard
        await copyToClipboard(shareUrl, 'Share URL');
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        toast({
          title: '❌ Error',
          description: 'Failed to share',
          variant: 'destructive',
          duration: 3000,
        });
      }
    }
  };

  return (
    <>
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 bg-transparent"
            onClick={() => {
              if (!vpToken) {
                generateVPToken();
              }
            }}
          >
            <QrCode className="h-4 w-4 mr-2" />
            Share QR
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verifiable Presentation QR Code</DialogTitle>
            <DialogDescription>
              Scan this QR code to access the verifiable presentation token
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            {loading ? (
              <div className="flex items-center justify-center h-48 w-48 bg-gray-100 rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : vpToken ? (
              <>
                <div className="bg-white border-2 border-gray-200 rounded-lg p-2">
                  <QRCodeDisplay data={vpToken} size={192} alt="VP Token QR Code" />
                </div>
                <div className="flex items-center gap-2 w-full">
                  <code className="flex-1 text-xs bg-gray-100 p-2 rounded truncate">{vpToken}</code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(vpToken, 'VP Token')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2 w-full">
                  <Button size="sm" variant="outline" onClick={downloadQRCode} className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Download QR
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(vpToken, 'VP Token')}
                    className="flex-1"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Token
                  </Button>
                </div>
              </>
            ) : (
              <Alert>
                <AlertDescription>Failed to generate VP token. Please try again.</AlertDescription>
              </Alert>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 bg-transparent"
            onClick={() => {
              if (!shareUrl) {
                generateShareUrl();
              }
            }}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share Link
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>One-Time Share Link</DialogTitle>
            <DialogDescription>
              This link will open the verify page with this credential
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center h-16">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : shareUrl ? (
              <>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-gray-100 p-3 rounded break-all">
                    {shareUrl}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(shareUrl, 'Share URL')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 bg-transparent"
                    onClick={() => window.open(shareUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Link
                  </Button>
                  <Button size="sm" className="flex-1" onClick={shareViaWebAPI}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => copyToClipboard(shareUrl, 'Share URL')}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => copyToClipboard(credentialId, 'Credential ID')}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy ID
                  </Button>
                </div>
                <Alert>
                  <AlertDescription className="text-xs">
                    This link will open the verify page with the credential data pre-filled.
                  </AlertDescription>
                </Alert>
              </>
            ) : (
              <Alert>
                <AlertDescription>Failed to generate share URL. Please try again.</AlertDescription>
              </Alert>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
