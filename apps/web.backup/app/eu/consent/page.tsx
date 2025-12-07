/**
 * B119A-FE-010: EUDI Wallet consent UI + GDPR purpose display
 *
 * Standalone consent page for EUDI wallet presentations with GDPR-compliant purpose display
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { EUDIConsentDialog, EUDIConsentRequest } from '@/components/EUDIConsentDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Info } from 'lucide-react';

export default function EUDIConsentPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [consentRequest, setConsentRequest] = useState<EUDIConsentRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(true);

  useEffect(() => {
    // Extract consent request from URL parameters or request body
    const purposeOfUse = searchParams.get('purpose_of_use') ||
      'Verification of identity and credentials for service access';
    const requestedAttributes = searchParams.get('attributes')?.split(',') ||
      ['name', 'dateOfBirth', 'nationalIdentifier'];
    const verifierName = searchParams.get('verifier_name') || 'Service Provider';
    const verifierId = searchParams.get('verifier_id') || 'unknown';
    const eudiReady = searchParams.get('eudi_ready') === 'true';

    setConsentRequest({
      purposeOfUse,
      requestedAttributes: requestedAttributes.map(name => ({
        name,
        description: getAttributeDescription(name),
        required: ['name', 'dateOfBirth'].includes(name),
      })),
      verifierName,
      verifierId,
      eudiReady,
    });
  }, [searchParams]);

  const handleAccept = async (consentedAttributes: string[]) => {
    // B119A-FE-010: Store user approval
    const approvalRecord = {
      timestamp: new Date().toISOString(),
      purposeOfUse: consentRequest?.purposeOfUse,
      verifierId: consentRequest?.verifierId,
      consentedAttributes,
      consentGiven: true,
    };

    // Store in localStorage
    try {
      const existing = JSON.parse(localStorage.getItem('eudi_approvals') || '[]');
      existing.push(approvalRecord);
      localStorage.setItem('eudi_approvals', JSON.stringify(existing.slice(-100)));
    } catch (error) {
      console.warn('Failed to store approval:', error);
    }

    // Redirect or callback
    const redirectUrl = searchParams.get('redirect_uri');
    if (redirectUrl) {
      window.location.href = redirectUrl + `?consent=approved&attributes=${consentedAttributes.join(',')}`;
    } else {
      setDialogOpen(false);
      router.push('/wallet');
    }
  };

  const handleReject = () => {
    const redirectUrl = searchParams.get('redirect_uri');
    if (redirectUrl) {
      window.location.href = redirectUrl + '?consent=rejected';
    } else {
      setDialogOpen(false);
      router.push('/wallet');
    }
  };

  const getAttributeDescription = (name: string): string => {
    const descriptions: Record<string, string> = {
      name: 'Your full name as it appears on your identity document',
      dateOfBirth: 'Your date of birth for age verification',
      nationalIdentifier: 'Your national identifier (e.g., SSN, passport number)',
      address: 'Your residential address',
      email: 'Your email address',
      phone: 'Your phone number',
    };
    return descriptions[name] || `Your ${name} information`;
  };

  if (!consentRequest) {
    return (
      <div className="container max-w-2xl py-12">
        <Card>
          <CardHeader>
            <CardTitle>Loading Consent Request</CardTitle>
            <CardDescription>Please wait while we load the consent details...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-12">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>EUDI Wallet Consent</CardTitle>
          </div>
          <CardDescription>
            Review and approve the consent request for sharing your credential data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* B119A-FE-010: GDPR purpose-of-use display */}
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>GDPR Compliance:</strong> This consent request includes a clear purpose-of-use
              statement as required by GDPR Article 6(1)(a). Your consent will be logged for audit purposes.
            </AlertDescription>
          </Alert>

          <EUDIConsentDialog
            request={consentRequest}
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            onAccept={handleAccept}
            onReject={handleReject}
          />
        </CardContent>
      </Card>
    </div>
  );
}

