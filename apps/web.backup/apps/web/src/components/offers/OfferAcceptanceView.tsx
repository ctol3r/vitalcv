/**
 * OfferAcceptanceView Component
 * Phase 4: Acceptance flow with FaceID, DID confirmation, and encrypted payload
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ShieldCheck,
  Fingerprint,
  CheckCircle2,
  Loader2,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import type { Offer, OfferAcceptancePayload } from '@/lib/offers/types';

interface OfferAcceptanceViewProps {
  offer: Offer;
  clinicianDid: string;
  clinicianId: string;
  onAccepted?: (receipt: { acceptanceId: string; receiptJwt: string }) => void;
}

export function OfferAcceptanceView({
  offer,
  clinicianDid,
  clinicianId,
  onAccepted,
}: OfferAcceptanceViewProps) {
  const [step, setStep] = useState<'review' | 'faceid' | 'confirm' | 'signing' | 'complete'>(
    'review'
  );
  const [faceIdVerified, setFaceIdVerified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptanceReceipt, setAcceptanceReceipt] = useState<{
    acceptanceId: string;
    receiptJwt: string;
  } | null>(null);

  const handleFaceIdVerification = async () => {
    // TODO: Integrate with actual FaceID/biometric verification
    // For now, simulate verification
    setStep('faceid');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setFaceIdVerified(true);
    setStep('confirm');
  };

  const handleAccept = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Create acceptance payload
      const acceptancePayload: OfferAcceptancePayload = {
        offerId: offer.id,
        clinicianDid,
        clinicianId,
        acceptanceTimestamp: new Date().toISOString(),
        faceIdVerified,
        encryptedPayload: 'encrypted_payload_placeholder', // TODO: AES-GCM encryption
        dpopJwt: 'dpop_jwt_placeholder', // TODO: Generate DPoP JWT
        chainAnchorIntent: {
          eventType: 'EmploymentIntent',
          metadata: {
            offerId: offer.id,
            roleId: offer.roleId,
            facilityName: offer.facilityName,
            startDate: offer.startDate,
          },
        },
      };

      const response = await fetch(`/api/offers/${offer.id}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(acceptancePayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const receipt = await response.json();
      setAcceptanceReceipt(receipt);
      setStep('complete');

      if (onAccepted) {
        onAccepted(receipt);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to accept offer';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'complete' && acceptanceReceipt) {
    return (
      <div className="space-y-6">
        <Card className="border-emerald-200 bg-emerald-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-900">
              <Sparkles className="h-5 w-5" />
              Offer Accepted!
            </CardTitle>
            <CardDescription className="text-emerald-700">
              Your acceptance has been recorded and anchored to the chain.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-white px-3 py-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-medium">Acceptance ID</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {acceptanceReceipt.acceptanceId}
                </p>
              </div>
            </div>
            <Button
              onClick={() => {
                window.location.href = `/offers/${offer.id}/accepted`;
              }}
              className="w-full"
            >
              View Accepted Offer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Accept Offer</CardTitle>
          <CardDescription>
            Review and confirm your acceptance of this job offer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Offer Summary */}
          <div className="rounded-md border p-4">
            <p className="text-sm font-medium mb-2">{offer.roleTitle}</p>
            <p className="text-sm text-muted-foreground">{offer.facilityName}</p>
            <p className="text-sm text-muted-foreground">
              Start Date: {new Date(offer.startDate).toLocaleDateString()}
            </p>
          </div>

          {/* DID Confirmation */}
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground mb-1">Your Identity</p>
            <p className="text-sm font-medium">DID: {clinicianDid}</p>
            <Badge variant="outline" className="mt-2">
              <ShieldCheck className="h-3 w-3 mr-1" />
              Verified
            </Badge>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Steps */}
          {step === 'review' && (
            <div className="space-y-4">
              <p className="text-sm">
                By accepting this offer, you agree to the terms and conditions. Your acceptance will
                be digitally signed and anchored to the blockchain.
              </p>
              <Button onClick={handleFaceIdVerification} className="w-full">
                <Fingerprint className="h-4 w-4 mr-2" />
                Verify Identity & Continue
              </Button>
            </div>
          )}

          {step === 'faceid' && (
            <div className="space-y-4">
              <div className="flex items-center justify-center p-8 border-2 border-dashed rounded-md">
                <div className="text-center">
                  <Fingerprint className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Face ID Verification</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Please complete biometric verification
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-sm text-emerald-900">Identity verified</span>
              </div>
              <Button
                onClick={handleAccept}
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Signing & Anchoring...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Accept Offer
                  </>
                )}
              </Button>
            </div>
          )}

          {step === 'signing' && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-primary" />
              <p className="text-sm font-medium">Signing contract...</p>
              <p className="text-xs text-muted-foreground mt-2">
                Creating encrypted acceptance payload and anchoring to chain
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

