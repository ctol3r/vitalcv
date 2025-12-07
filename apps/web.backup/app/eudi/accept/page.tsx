/**
 * B102A-FE-007: EUDI accept UI page
 *
 * Page for accepting EUDI wallet verification requests with consent UI
 */

'use client';

import { EUDIConsentDialog, EUDIReadyBadge, EUDIConsentRequest } from '@/components/EUDIConsentDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function EUDIAcceptPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentRequest, setConsentRequest] = useState<EUDIConsentRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [trustListStale, setTrustListStale] = useState(false);
  const [refreshingTrustList, setRefreshingTrustList] = useState(false);

  // Extract request parameters from URL
  useEffect(() => {
    const verifierId = searchParams.get('verifier_id');
    const purpose = searchParams.get('purpose');
    const attributes = searchParams.get('attributes');

    if (verifierId && purpose) {
      // Parse attributes if provided
      let requestedAttributes: Array<{ name: string; description?: string; required?: boolean }> = [];
      if (attributes) {
        try {
          requestedAttributes = JSON.parse(decodeURIComponent(attributes));
        } catch {
          // Fallback: treat as comma-separated list
          requestedAttributes = attributes.split(',').map(name => ({ name: name.trim() }));
        }
      } else {
        // Default attributes if none specified
        requestedAttributes = [
          { name: 'given_name', description: 'Your first name', required: true },
          { name: 'family_name', description: 'Your last name', required: true },
          { name: 'date_of_birth', description: 'Your date of birth', required: false },
        ];
      }

      setConsentRequest({
        purposeOfUse: decodeURIComponent(purpose),
        requestedAttributes,
        verifierId,
        verifierName: searchParams.get('verifier_name') || undefined,
        eudiReady: searchParams.get('eudi_ready') === 'true',
      });
    }
    setLoading(false);
  }, [searchParams]);

  // Check trust list freshness on mount (B105A-FE-007)
  useEffect(() => {
    const checkTrustList = async () => {
      try {
        const response = await fetch('/api/eudi/trust-list/status');
        if (response.ok) {
          const data = await response.json();
          // Consider trust list stale if last refresh was > 24 hours ago
          if (data.lastRefresh) {
            const lastRefreshTime = new Date(data.lastRefresh).getTime();
            const hoursSinceRefresh = (Date.now() - lastRefreshTime) / (1000 * 60 * 60);
            setTrustListStale(hoursSinceRefresh > 24);
          }
        }
      } catch (error) {
        console.warn('Failed to check trust list status:', error);
      }
    };

    checkTrustList();
  }, []);

  const handleRefreshTrustList = async () => {
    setRefreshingTrustList(true);
    try {
      const response = await fetch('/api/eudi/trust-list/refresh', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to refresh trust list');
      }

      setTrustListStale(false);
      toast({
        title: 'Trust List Refreshed',
        description: 'The trust list has been successfully updated.',
      });
    } catch (error) {
      toast({
        title: 'Refresh Failed',
        description: 'Failed to refresh trust list. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRefreshingTrustList(false);
    }
  };

  const handleAccept = async (consentedAttributes: string[]) => {
    // If trust list is stale, prompt user to refresh first
    if (trustListStale) {
      toast({
        title: 'Trust List Stale',
        description: 'Please refresh the trust list before proceeding.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Call backend to process consent
      const response = await fetch('/api/eudi/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verifierId: consentRequest?.verifierId,
          purposeOfUse: consentRequest?.purposeOfUse,
          consentedAttributes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Check if error is due to stale trust list
        if (errorData.error === 'trust_list_stale' || response.status === 422) {
          setTrustListStale(true);
          toast({
            title: 'Trust List Stale',
            description: 'The trust list needs to be refreshed. Please click "Refresh Trust List" and try again.',
            variant: 'destructive',
          });
          return;
        }

        throw new Error('Failed to process consent');
      }

      const data = await response.json();

      toast({
        title: 'Consent Granted',
        description: 'Your credential has been shared with the verifier.',
      });

      // Redirect to success page or back
      router.push(`/eudi/status?success=true&audit_ref=${data.auditRef}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process consent. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleReject = () => {
    toast({
      title: 'Consent Rejected',
      description: 'You have rejected the consent request.',
    });
    router.back();
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <p className="text-gray-500">Loading consent request...</p>
      </div>
    );
  }

  if (!consentRequest) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Invalid Request</CardTitle>
            <CardDescription>
              Missing required parameters for consent request.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.back()} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <Button
          onClick={() => router.back()}
          variant="ghost"
          size="sm"
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-8 w-8 text-blue-600" aria-hidden="true" />
          <h1 className="text-3xl font-bold">EUDI Wallet Verification Request</h1>
        </div>
        <p className="text-gray-600">
          A verifier is requesting access to your credential data. Review the details below.
        </p>
      </div>

      {/* Trust List Stale Warning (B105A-FE-007) */}
      {trustListStale && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <strong>Trust List Stale</strong>
              <p className="text-sm mt-1">
                The trust list has not been refreshed recently. Please refresh it before proceeding with verification.
              </p>
            </div>
            <Button
              onClick={handleRefreshTrustList}
              disabled={refreshingTrustList}
              size="sm"
              variant="outline"
              className="ml-4"
            >
              {refreshingTrustList ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-2" />
                  Refresh Trust List
                </>
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Verification Request</CardTitle>
            {consentRequest.eudiReady && <EUDIReadyBadge />}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {consentRequest.verifierName && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Verifier</p>
              <p className="text-sm">{consentRequest.verifierName}</p>
              {consentRequest.verifierId && (
                <p className="text-xs text-gray-500 font-mono mt-1">{consentRequest.verifierId}</p>
              )}
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Purpose of Use</p>
            <p className="text-sm text-gray-600">{consentRequest.purposeOfUse}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Requested Attributes ({consentRequest.requestedAttributes.length})
            </p>
            <div className="space-y-1">
              {consentRequest.requestedAttributes.map((attr) => (
                <div key={attr.name} className="flex items-center gap-2 text-sm">
                  <Badge variant={attr.required ? 'default' : 'outline'} className="text-xs">
                    {attr.name}
                    {attr.required && ' (required)'}
                  </Badge>
                  {attr.description && (
                    <span className="text-gray-500 text-xs">{attr.description}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {trustListStale && (
              <Button
                onClick={handleRefreshTrustList}
                disabled={refreshingTrustList}
                variant="outline"
                className="w-full sm:w-auto"
                size="lg"
              >
                {refreshingTrustList ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh Trust List
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={() => setConsentOpen(true)}
              className="w-full sm:w-auto"
              size="lg"
              disabled={trustListStale}
            >
              Review & Accept
            </Button>
          </div>
        </CardContent>
      </Card>

      <EUDIConsentDialog
        request={consentRequest}
        open={consentOpen}
        onClose={() => setConsentOpen(false)}
        onAccept={handleAccept}
        onReject={handleReject}
      />
    </div>
  );
}

