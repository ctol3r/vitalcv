/**
 * Task 203.39 — Add QR code generator for credential offers
 * Task 203.40 — Add deep link support for mobile wallets
 * Task 203.41 — Add developer-mode UI for credential offers
 * Show QR code and deep links for credential offer
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QrCode, Smartphone, Code, Copy, Check, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CredentialOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentialOffer: any;
  credentialType: string;
}

export function CredentialOfferModal({
  isOpen,
  onClose,
  credentialOffer,
  credentialType,
}: CredentialOfferModalProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('qr');

  // Generate QR code when modal opens
  useEffect(() => {
    if (isOpen && credentialOffer) {
      generateQRCode();
    }
  }, [isOpen, credentialOffer]);

  const generateQRCode = async () => {
    try {
      // Generate credential offer URI
      const offerUri = generateCredentialOfferURI();

      // Use a QR code library (would need to install qrcode package)
      // For now, using a placeholder API
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(offerUri)}`;
      setQrCodeDataUrl(qrApiUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const generateCredentialOfferURI = (): string => {
    const offerJson = JSON.stringify(credentialOffer.credential_offer);
    return `openid-credential-offer://?credential_offer=${encodeURIComponent(offerJson)}`;
  };

  const generateDeepLink = (platform: 'ios' | 'android' | 'generic'): string => {
    const offerJson = JSON.stringify(credentialOffer.credential_offer);

    switch (platform) {
      case 'ios':
        return `https://wallet.vitalcv.com/credential-offer?credential_offer=${encodeURIComponent(offerJson)}`;
      case 'android':
        return `https://wallet.vitalcv.com/credential-offer?credential_offer=${encodeURIComponent(offerJson)}`;
      default:
        return generateCredentialOfferURI();
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const openDeepLink = (platform: 'ios' | 'android' | 'generic') => {
    const link = generateDeepLink(platform);
    window.open(link, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add {credentialType} to Wallet</DialogTitle>
          <DialogDescription>
            Scan the QR code with your mobile wallet or use a deep link to add this credential.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="qr">
              <QrCode className="mr-2 h-4 w-4" />
              QR Code
            </TabsTrigger>
            <TabsTrigger value="links">
              <Smartphone className="mr-2 h-4 w-4" />
              Deep Links
            </TabsTrigger>
            <TabsTrigger value="developer">
              <Code className="mr-2 h-4 w-4" />
              Developer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="qr" className="space-y-4">
            <div className="flex flex-col items-center justify-center p-6">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="Credential Offer QR Code"
                  className="w-64 h-64 border-4 border-gray-200 rounded-lg"
                />
              ) : (
                <div className="w-64 h-64 bg-gray-100 animate-pulse rounded-lg" />
              )}
              <p className="mt-4 text-sm text-gray-600 text-center">
                Scan this QR code with your mobile wallet app
              </p>
            </div>

            <Alert>
              <AlertDescription>
                Session expires at: {new Date(credentialOffer.expires_at).toLocaleString()}
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="links" className="space-y-4">
            <div className="space-y-3">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">iOS Wallet</h4>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => openDeepLink('ios')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in iOS Wallet
                </Button>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Android Wallet</h4>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => openDeepLink('android')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in Android Wallet
                </Button>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Generic Wallet</h4>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => openDeepLink('generic')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open with OpenID4VCI
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="developer" className="space-y-4">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Credential Offer JSON</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(JSON.stringify(credentialOffer.credential_offer, null, 2))}
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <pre className="p-4 bg-gray-50 rounded-lg overflow-auto max-h-64 text-xs">
                  {JSON.stringify(credentialOffer.credential_offer, null, 2)}
                </pre>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Credential Offer URI</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(generateCredentialOfferURI())}
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <pre className="p-4 bg-gray-50 rounded-lg overflow-auto text-xs break-all">
                  {generateCredentialOfferURI()}
                </pre>
              </div>

              <div>
                <h4 className="font-medium mb-2">Session Details</h4>
                <div className="p-4 bg-gray-50 rounded-lg text-sm space-y-1">
                  <p><span className="font-medium">Session ID:</span> {credentialOffer.session_id}</p>
                  <p><span className="font-medium">Expires:</span> {new Date(credentialOffer.expires_at).toLocaleString()}</p>
                  <p><span className="font-medium">Credential Issuer:</span> {credentialOffer.credential_offer.credential_issuer}</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

