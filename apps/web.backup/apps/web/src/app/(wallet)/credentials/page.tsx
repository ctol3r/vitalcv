/**
 * DC-011: Present Credential Flow
 * Wallet page for listing credentials with actions to present them
 */

'use client';

import { useState, useEffect } from 'react';
import {
  isChromeDigitalCredentialsAvailable,
  presentCredentials,
  getUnavailableMessage,
  type DigitalCredential
} from '@/lib/digital-credentials/chrome-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Smartphone, Download, QrCode, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<DigitalCredential[]>([]);
  const [isChromeAvailable, setIsChromeAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [presenting, setPresenting] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setIsChromeAvailable(isChromeDigitalCredentialsAvailable());

    // Load credentials from API
    async function loadCredentials() {
      try {
        // TODO: Replace with your actual credential storage API endpoint
        const response = await fetch('/api/wallet/credentials');
        if (response.ok) {
          const data = await response.json();
          setCredentials(data);
        } else {
          // Fallback to empty array or show error
          console.warn('Failed to load credentials:', response.statusText);
          setCredentials([]);
        }
      } catch (error) {
        console.error('Error loading credentials:', error);
        setCredentials([]);
      } finally {
        setLoading(false);
      }
    }

    loadCredentials();
  }, []);

  const handlePresentViaBrowser = async (credentialId: string, requestUrl?: string) => {
    if (!isChromeAvailable) {
      toast({
        title: 'Browser Not Supported',
        description: getUnavailableMessage(),
        variant: 'destructive',
      });
      return;
    }

    setPresenting(credentialId);

    try {
      // If no request URL provided, prompt user to enter or scan one
      if (!requestUrl) {
        const url = prompt('Enter or paste the OID4VP request URL:');
        if (!url) {
          setPresenting(null);
          return;
        }
        requestUrl = url;
      }

      const result = await presentCredentials({ url: requestUrl });

      if (result.success && result.vpToken) {
        toast({
          title: 'Credentials Presented',
          description: 'Your credentials have been successfully presented to the verifier.',
          variant: 'default',
        });

        // TODO: Show verification result from verifier API
        // You can poll the verification endpoint or use webhooks
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
      setPresenting(null);
    }
  };

  const handleShowQR = (credentialId: string) => {
    // TODO: Generate QR code for credential
    toast({
      title: 'QR Code',
      description: 'QR code functionality coming soon',
    });
  };

  const handleDownload = (credentialId: string) => {
    // TODO: Download credential as file
    toast({
      title: 'Download',
      description: 'Download functionality coming soon',
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading credentials...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">My Credentials</h1>
        <p className="text-muted-foreground">
          View and present your verifiable credentials
        </p>
      </div>

      {!isChromeAvailable && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Browser Support</AlertTitle>
          <AlertDescription>
            {getUnavailableMessage()}
          </AlertDescription>
        </Alert>
      )}

      {credentials.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No credentials found. Start by claiming your NPI or receiving credentials from an issuer.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {credentials.map((credential) => (
            <Card key={credential.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {credential.type.filter(t => t !== 'VerifiableCredential').join(', ')}
                      <Badge variant="secondary">
                        {credential.credentialSubject.status || 'active'}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Issuer: {credential.issuer}
                      {credential.issuanceDate && (
                        <span className="ml-4">
                          Issued: {new Date(credential.issuanceDate).toLocaleDateString()}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Credential Details</h4>
                    <div className="bg-muted p-3 rounded-md">
                      <pre className="text-xs overflow-auto">
                        {JSON.stringify(credential.credentialSubject, null, 2)}
                      </pre>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => handlePresentViaBrowser(credential.id)}
                      disabled={presenting === credential.id || !isChromeAvailable}
                      variant="default"
                    >
                      <Smartphone className="mr-2 h-4 w-4" />
                      {presenting === credential.id ? 'Presenting...' : 'Present via Browser'}
                    </Button>

                    <Button
                      onClick={() => handleShowQR(credential.id)}
                      variant="outline"
                    >
                      <QrCode className="mr-2 h-4 w-4" />
                      Show QR
                    </Button>

                    <Button
                      onClick={() => handleDownload(credential.id)}
                      variant="outline"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

