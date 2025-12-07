/**
 * DC-013: Verifier-side "Check VitalCV" Panel
 * Panel that walks verifiers through OID4VP request generation and verification
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { QrCode, Link as LinkIcon, CheckCircle2, XCircle, Clock, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import QRCode from 'qrcode.react';

interface VerificationResult {
  status: 'verified' | 'failed' | 'partial' | 'pending';
  subjectInfo?: {
    npi?: string;
    did?: string;
    email?: string;
    name?: string;
  };
  credentialSummaries?: Array<{
    type: string;
    issuer: string;
    issueDate?: string;
    status: 'valid' | 'invalid' | 'expired';
  }>;
  policyFlags?: {
    allRequiredPresent: boolean;
    missingCredentials: string[];
  };
}

export default function CheckVitalCVPage() {
  const [workflow, setWorkflow] = useState<string>('full_onboarding');
  const [requestData, setRequestData] = useState<{
    sessionId: string;
    requestUrl: string;
    qrPayload: string;
    expiresAt: string;
  } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [polling, setPolling] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const { toast } = useToast();

  const workflows = [
    { value: 'full_onboarding', label: 'Full Onboarding' },
    { value: 'quick_privileges_check', label: 'Quick Privileges Check' },
    { value: 'hospitalist_onboarding', label: 'Hospitalist Onboarding' },
    { value: 'locums_assignment', label: 'Locums Assignment' },
    { value: 'credentialing_renewal', label: 'Credentialing Renewal' },
  ];

  const handleGenerateRequest = async () => {
    setGenerating(true);
    setVerificationResult(null);

    try {
      const response = await fetch('/api/oid4vp/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflow,
          orgId: 'current-org-id', // TODO: Get from auth context
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error_description || 'Failed to generate request');
      }

      const data = await response.json();
      setRequestData(data);

      // Start polling for verification result
      startPolling(data.sessionId);

      toast({
        title: 'Request Generated',
        description: 'Share the QR code or link with the candidate',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate request',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const startPolling = (sessionId: string) => {
    setPolling(true);
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/oid4vp/request/${sessionId}`, {
          method: 'GET',
        });
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(interval);
            setPolling(false);

            // Fetch verification result
            if (data.status === 'completed') {
              await fetchVerificationResult(sessionId);
            }
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000); // Poll every 2 seconds

    // Stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(interval);
      setPolling(false);
    }, 300000);
  };

  const fetchVerificationResult = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/oid4vp/verify/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setVerificationResult(data.result);
      }
    } catch (error) {
      console.error('Error fetching verification result:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Link copied to clipboard',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'partial':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Check VitalCV</h1>
        <p className="text-muted-foreground">
          Generate an OID4VP request to verify a candidate's credentials
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Step 1: Generate Request */}
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Generate Request</CardTitle>
            <CardDescription>Select a verification workflow</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={workflow} onValueChange={setWorkflow}>
              <SelectTrigger>
                <SelectValue placeholder="Select workflow" />
              </SelectTrigger>
              <SelectContent>
                {workflows.map((wf) => (
                  <SelectItem key={wf.value} value={wf.value}>
                    {wf.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={handleGenerateRequest}
              disabled={generating}
              className="w-full"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Request'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Step 2: Show QR/Link */}
        {requestData && (
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Share Request</CardTitle>
              <CardDescription>Share the QR code or link with the candidate</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <QRCode value={requestData.qrPayload} size={200} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Request Link</label>
                <div className="flex gap-2">
                  <Input
                    value={requestData.requestUrl}
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    onClick={() => copyToClipboard(requestData.requestUrl)}
                    variant="outline"
                    size="icon"
                  >
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Alert>
                <AlertDescription>
                  Expires at: {new Date(requestData.expiresAt).toLocaleString()}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Wait for Presentation */}
        {requestData && !verificationResult && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Step 3: Waiting for Presentation
                {polling && <Loader2 className="h-4 w-4 animate-spin" />}
              </CardTitle>
              <CardDescription>
                Waiting for the candidate to present their credentials...
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Please ask the candidate to scan the QR code or open the link
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Display Verification Result */}
        {verificationResult && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Step 4: Verification Result
                {getStatusIcon(verificationResult.status)}
              </CardTitle>
              <CardDescription>
                {verificationResult.status === 'verified' && 'All credentials verified successfully'}
                {verificationResult.status === 'failed' && 'Verification failed'}
                {verificationResult.status === 'partial' && 'Some credentials are missing or invalid'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {verificationResult.subjectInfo && (
                <div>
                  <h4 className="font-medium mb-2">Subject Information</h4>
                  <div className="bg-muted p-3 rounded-md space-y-1">
                    {verificationResult.subjectInfo.name && (
                      <div>Name: {verificationResult.subjectInfo.name}</div>
                    )}
                    {verificationResult.subjectInfo.npi && (
                      <div>NPI: {verificationResult.subjectInfo.npi}</div>
                    )}
                    {verificationResult.subjectInfo.email && (
                      <div>Email: {verificationResult.subjectInfo.email}</div>
                    )}
                  </div>
                </div>
              )}

              {verificationResult.credentialSummaries && verificationResult.credentialSummaries.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Credential Summary</h4>
                  <div className="space-y-2">
                    {verificationResult.credentialSummaries.map((cred, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-md">
                        <div>
                          <div className="font-medium">{cred.type}</div>
                          <div className="text-sm text-muted-foreground">
                            Issuer: {cred.issuer}
                          </div>
                        </div>
                        <Badge
                          variant={
                            cred.status === 'valid' ? 'default' :
                            cred.status === 'expired' ? 'secondary' : 'destructive'
                          }
                        >
                          {cred.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {verificationResult.policyFlags && (
                <Alert variant={verificationResult.policyFlags.allRequiredPresent ? 'default' : 'destructive'}>
                  <AlertTitle>
                    {verificationResult.policyFlags.allRequiredPresent
                      ? 'All Required Credentials Present'
                      : 'Missing Credentials'}
                  </AlertTitle>
                  {verificationResult.policyFlags.missingCredentials.length > 0 && (
                    <AlertDescription>
                      Missing: {verificationResult.policyFlags.missingCredentials.join(', ')}
                    </AlertDescription>
                  )}
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

