/**
 * OfferSendView Component
 * Phase 2: Secure P2P delivery options (email, QR, in-app, chat)
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOfferLinkGenerator } from '@/lib/offers/useOfferLinkGenerator';
import {
  Mail,
  QrCode,
  MessageSquare,
  Smartphone,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import type { Offer } from '@/lib/offers/types';

interface OfferSendViewProps {
  offer: Offer;
  onSent?: () => void;
}

export function OfferSendView({ offer, onSent }: OfferSendViewProps) {
  const { generateLink, generateQRCode, isGenerating, error } = useOfferLinkGenerator();
  const [selectedMethod, setSelectedMethod] = useState<'email' | 'qr' | 'in-app' | 'chat' | null>(
    null
  );
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSend = async (method: 'email' | 'qr' | 'in-app' | 'chat') => {
    setSelectedMethod(method);
    setGeneratedLink(null);
    setQrCode(null);

    if (method === 'qr') {
      const qr = await generateQRCode(offer.id);
      if (qr) {
        setQrCode(qr);
      }
    } else if (method === 'email' || method === 'in-app') {
      const link = await generateLink(offer.id, method);
      if (link) {
        setGeneratedLink(link.signedUrl);
      }
    } else if (method === 'chat') {
      // TODO: Integrate with recruiter chat system
      // For now, generate a link
      const link = await generateLink(offer.id, 'in-app');
      if (link) {
        setGeneratedLink(link.signedUrl);
      }
    }
  };

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConfirmSend = async () => {
    try {
      const response = await fetch(`/api/offers/${offer.id}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: selectedMethod,
          link: generatedLink,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send offer');
      }

      if (onSent) {
        onSent();
      }
    } catch (err) {
      console.error('Failed to send offer:', err);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Send Offer</CardTitle>
          <CardDescription>
            Choose a secure delivery method for this offer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Delivery Methods */}
          <div className="grid gap-4 md:grid-cols-2">
            <Button
              variant="outline"
              className="h-auto flex-col items-start p-4"
              onClick={() => handleSend('email')}
              disabled={isGenerating}
            >
              <Mail className="h-5 w-5 mb-2" />
              <span className="font-medium">Email Link</span>
              <span className="text-xs text-muted-foreground mt-1">
                Send secure link via email
              </span>
            </Button>

            <Button
              variant="outline"
              className="h-auto flex-col items-start p-4"
              onClick={() => handleSend('qr')}
              disabled={isGenerating}
            >
              <QrCode className="h-5 w-5 mb-2" />
              <span className="font-medium">QR Code</span>
              <span className="text-xs text-muted-foreground mt-1">
                Generate QR for in-person delivery
              </span>
            </Button>

            <Button
              variant="outline"
              className="h-auto flex-col items-start p-4"
              onClick={() => handleSend('in-app')}
              disabled={isGenerating}
            >
              <Smartphone className="h-5 w-5 mb-2" />
              <span className="font-medium">In-App Direct</span>
              <span className="text-xs text-muted-foreground mt-1">
                Send directly within the app
              </span>
            </Button>

            <Button
              variant="outline"
              className="h-auto flex-col items-start p-4"
              onClick={() => handleSend('chat')}
              disabled={isGenerating}
            >
              <MessageSquare className="h-5 w-5 mb-2" />
              <span className="font-medium">Recruiter Chat</span>
              <span className="text-xs text-muted-foreground mt-1">
                Send via recruiter chat system
              </span>
            </Button>
          </div>

          {isGenerating && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating secure link...</span>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              {error}
            </div>
          )}

          {/* Generated Link */}
          {generatedLink && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Generated Link</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedLink}
                  className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <Button onClick={handleConfirmSend} className="w-full">
                Confirm & Send Offer
              </Button>
            </div>
          )}

          {/* QR Code */}
          {qrCode && (
            <div className="space-y-2">
              <p className="text-sm font-medium">QR Code</p>
              <div className="flex justify-center">
                <img src={qrCode} alt="Offer QR Code" className="w-64 h-64" />
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Clinician can scan this QR code to view the offer
              </p>
              <Button onClick={handleConfirmSend} className="w-full">
                Confirm & Send Offer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

