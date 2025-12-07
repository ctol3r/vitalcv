/**
 * DC-012: QR-based OID4VP Presentation for Mobile Wallets
 * Entry point for scanning QR codes or accepting deep links with OID4VP request URLs
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { presentCredentials, isChromeDigitalCredentialsAvailable } from '@/lib/digital-credentials/chrome-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { QrCode, Link as LinkIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ScanPage() {
  const [requestUrl, setRequestUrl] = useState('');
  const [presenting, setPresenting] = useState(false);
  const [success, setSuccess] = useState(false);
  const searchParams = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    // Check if URL was provided via deep link or query parameter
    const urlParam = searchParams.get('url');
    if (urlParam) {
      setRequestUrl(decodeURIComponent(urlParam));
    }
  }, [searchParams]);

  const handleScanQR = () => {
    // TODO: Integrate QR code scanner library (e.g., react-qr-reader)
    toast({
      title: 'QR Scanner',
      description: 'QR scanner functionality coming soon. Please paste the URL manually.',
    });
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRequestUrl(text);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to read from clipboard',
        variant: 'destructive',
      });
    }
  };

  const handlePresent = async () => {
    if (!requestUrl) {
      toast({
        title: 'Error',
        description: 'Please enter or paste an OID4VP request URL',
        variant: 'destructive',
      });
      return;
    }

    setPresenting(true);
    setSuccess(false);

    try {
      const result = await presentCredentials({ url: requestUrl });

      if (result.success) {
        setSuccess(true);
        toast({
          title: 'Credentials Presented',
          description: 'Your credentials have been successfully presented to the verifier.',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Presentation Failed',
          description: result.error || 'Failed to present credentials',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setPresenting(false);
    }
  };

  const isChromeAvailable = isChromeDigitalCredentialsAvailable();

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Present Credentials</h1>
        <p className="text-muted-foreground">
          Scan a QR code or paste an OID4VP request URL to present your credentials
        </p>
      </div>

      {!isChromeAvailable && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Browser Support</AlertTitle>
          <AlertDescription>
            Chrome Digital Credentials API is not available. You can still use QR code or manual URL entry.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>OID4VP Request</CardTitle>
          <CardDescription>
            Enter or scan the presentation request from the verifier
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="request-url" className="text-sm font-medium">
              Request URL
            </label>
            <div className="flex gap-2">
              <Input
                id="request-url"
                type="url"
                placeholder="openid-credential-offer://?client_id=..."
                value={requestUrl}
                onChange={(e) => setRequestUrl(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handlePaste}
                variant="outline"
                size="icon"
              >
                <LinkIcon className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleScanQR}
                variant="outline"
                size="icon"
              >
                <QrCode className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button
            onClick={handlePresent}
            disabled={!requestUrl || presenting}
            className="w-full"
            size="lg"
          >
            {presenting ? 'Presenting...' : success ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Presented Successfully
              </>
            ) : (
              'Present Credentials'
            )}
          </Button>

          {success && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>
                Your credentials have been presented. The verifier will process the verification and notify you of the result.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

