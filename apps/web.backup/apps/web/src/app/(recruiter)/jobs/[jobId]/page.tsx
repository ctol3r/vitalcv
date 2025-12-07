/**
 * DC-014: "Apply with VitalCV" Button on Job Postings
 * Adds OID4VP request generation to job detail pages for verifiable applications
 */

'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QrCode, Link as LinkIcon, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import QRCode from 'qrcode.react';

export default function JobDetailPage() {
  const params = useParams();
  const jobId = params?.jobId as string;
  const [requestData, setRequestData] = useState<{
    sessionId: string;
    requestUrl: string;
    qrPayload: string;
    expiresAt: string;
  } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  // TODO: Fetch job details from API
  const job = {
    id: jobId,
    title: 'Hospitalist Position',
    organization: 'Example Hospital',
    location: 'San Francisco, CA',
    // ... other job fields
  };

  const handleApplyWithVitalCV = async () => {
    setGenerating(true);
    setDialogOpen(true);

    try {
      // Generate OID4VP request tailored to this role
      // Use hospitalist_onboarding workflow for hospitalist positions
      const workflow = job.title.toLowerCase().includes('hospitalist')
        ? 'hospitalist_onboarding'
        : 'full_onboarding';

      const response = await fetch('/api/oid4vp/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflow,
          orgId: 'current-org-id', // TODO: Get from auth context
          // Link to job posting
          metadata: {
            jobId: job.id,
            jobTitle: job.title,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error_description || 'Failed to generate request');
      }

      const data = await response.json();
      setRequestData(data);

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Link copied to clipboard',
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Job Details */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{job.title}</CardTitle>
          <CardDescription>
            {job.organization} • {job.location}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Job description, requirements, etc. */}
          <p className="text-muted-foreground">
            Job details and description would go here...
          </p>

          <div className="mt-6 flex gap-4">
            <Button onClick={handleApplyWithVitalCV} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Apply with VitalCV
                </>
              )}
            </Button>
            <Button variant="outline">Apply Traditionally</Button>
          </div>
        </CardContent>
      </Card>

      {/* OID4VP Request Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply with VitalCV</DialogTitle>
            <DialogDescription>
              Share this QR code or link with the candidate to verify their credentials
            </DialogDescription>
          </DialogHeader>

          {generating ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : requestData ? (
            <div className="space-y-4">
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <QRCode value={requestData.qrPayload} size={200} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Request Link</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={requestData.requestUrl}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted"
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

              <div className="text-sm text-muted-foreground">
                <p>
                  After the candidate presents their credentials, their verified information
                  will be pre-filled in the candidate record and linked to this application.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              Failed to generate request. Please try again.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

