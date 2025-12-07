'use client';

export const runtime = 'edge';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Scanner } from '@yudiel/react-qr-scanner';
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function ScanPage() {
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const { toast } = useToast();

  const handleScan = (results: any[]) => {
    if (results && results.length > 0) {
        const data = results[0].rawValue;
        if (data && !scannedData && !verifying) {
            setScannedData(data);
            verifyPresentation(data);
        }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput && !verifying) {
        setScannedData(manualInput);
        verifyPresentation(manualInput);
    }
  };

  const verifyPresentation = async (data: string) => {
    setVerifying(true);
    try {
        // Try to parse if it's a URL with a VP or OOB invitation
        let payload = {};

        // Check if it is a URL
        if (data.startsWith('http') || data.startsWith('vitalcv://')) {
            // Basic parsing logic for demo
            try {
                const urlString = data.replace('vitalcv://', 'https://placeholder/');
                const url = new URL(urlString);
                const vpParam = url.searchParams.get('vp');
                const oobParam = url.searchParams.get('_oob');

                if (vpParam) {
                    payload = JSON.parse(decodeURIComponent(vpParam));
                } else if (oobParam) {
                     // OOB handling
                     payload = { oob: oobParam };
                } else {
                    // Treat entire data as payload or fetch it
                    payload = { raw: data };
                }
            } catch (e) {
                console.warn('Failed to parse URL params, using raw data', e);
                payload = { raw: data };
            }
        } else {
            try {
                payload = JSON.parse(data);
            } catch {
                payload = { raw: data };
            }
        }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/didcomm/present-proof`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            // Wrap in DIDComm message structure if needed or send as is
            // For now, we send what we have and let backend handle/validate
            attachments: [
                {
                    format: 'base64', // or json
                    data: { json: payload }
                }
            ]
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setVerificationResult({
          success: true,
          message: result.details || 'Verification successful',
        });
        toast({
            title: 'Verified',
            description: 'Credential verified successfully',
        });
      } else {
        throw new Error(result.error || 'Verification failed');
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      setVerificationResult({
        success: false,
        message: error.message || 'Failed to verify credential',
      });
      toast({
        title: 'Verification Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
  };

  const resetScan = () => {
    setScannedData(null);
    setVerificationResult(null);
    setVerifying(false);
    setManualInput('');
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4 pl-0">
          <Link href="/verifier">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Scan Credential</h1>
        <p className="text-muted-foreground mt-2">
          Scan a QR code to verify a credential presentation
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scanner</CardTitle>
          <CardDescription>Point the clinician’s wallet QR here. If unable, use manual entry below.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          {!scannedData ? (
            <>
            <div className="w-full aspect-square max-w-sm relative overflow-hidden rounded-lg border bg-black">
               <Scanner
                  onScan={handleScan}
                  onError={(error) => console.log(error)}
                  components={{ audio: false, torch: false }}
               />
            </div>

            <div className="w-full max-w-sm border-t pt-6">
                <form onSubmit={handleManualSubmit} className="flex gap-2">
                    <Input
                        placeholder="Enter code manually"
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                    />
                    <Button type="submit" disabled={!manualInput}>Verify</Button>
                </form>
            </div>
            </>
          ) : (
            <div className="w-full py-8 text-center space-y-6">
              {verifying ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-lg font-medium">Verifying credential...</p>
                </div>
              ) : verificationResult ? (
                <div className="flex flex-col items-center gap-4">
                  {verificationResult.success ? (
                    <div className="text-green-600 flex flex-col items-center gap-2">
                      <CheckCircle2 className="h-16 w-16" />
                      <h3 className="text-xl font-bold">Verified!</h3>
                    </div>
                  ) : (
                    <div className="text-red-600 flex flex-col items-center gap-2">
                      <XCircle className="h-16 w-16" />
                      <h3 className="text-xl font-bold">Verification Failed</h3>
                    </div>
                  )}
                  <p className="text-muted-foreground">{verificationResult.message}</p>
                  <Button onClick={resetScan} className="mt-4">
                    Scan Another
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
