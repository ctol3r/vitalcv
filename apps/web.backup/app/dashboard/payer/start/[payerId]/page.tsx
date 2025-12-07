'use client';

/**
 * B137B-FE-002: Start Enrollment Draft from CAQH + VitalCV
 *
 * Prepopulated fields from CAQH & VitalCV, shows missing items, submit creates DRAFT.
 * Accessible form with clear labeling and validation.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthGuard } from '@/components/auth-guard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Shield,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  FileText,
  Building2,
  Calendar,
  Upload,
  Loader2
} from 'lucide-react';
import { startEnrollmentDraft, submitEnrollment, uploadEvidence } from '@/lib/payer-client';
import type { EnrollmentDraftData, ProductLine, PayerEnrollment } from '@/lib/payer-types';
import { cn } from '@/lib/utils';

export default function StartEnrollmentDraftPage() {
  const params = useParams();
  const router = useRouter();
  const payerId = params.payerId as string;

  const [draftData, setDraftData] = useState<EnrollmentDraftData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Form state
  const [selectedProductLines, setSelectedProductLines] = useState<ProductLine[]>([]);
  const [missingFieldValues, setMissingFieldValues] = useState<Record<string, string>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File>>({});

  useEffect(() => {
    async function loadDraft() {
      setLoading(true);
      try {
        // TODO: Get NPI from session/auth context
        const clinicianNpi = '1234567890'; // Placeholder

        const draft = await startEnrollmentDraft(payerId, clinicianNpi);
        setDraftData(draft);

        // Pre-select common product lines if any
        if (draft.productLines.length > 0) {
          setSelectedProductLines(draft.productLines);
        }
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to load enrollment draft. Please try again.',
          variant: 'destructive'
        });
        console.error('Failed to load draft:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDraft();
  }, [payerId, toast]);

  const handleToggleProductLine = (line: ProductLine) => {
    setSelectedProductLines((prev) =>
      prev.includes(line)
        ? prev.filter((l) => l !== line)
        : [...prev, line]
    );
  };

  const handleFieldChange = (field: string, value: string) => {
    setMissingFieldValues((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileUpload = (docType: string, file: File) => {
    setUploadedFiles((prev) => ({
      ...prev,
      [docType]: file
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedProductLines.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select at least one product line.',
        variant: 'destructive'
      });
      return;
    }

    // Check required missing fields
    const requiredMissing = draftData?.missingItems.filter(item => item.required) || [];
    const hasAllRequired = requiredMissing.every(item => {
      if (item.type === 'document') {
        return uploadedFiles[item.field];
      }
      return missingFieldValues[item.field];
    });

    if (!hasAllRequired) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);
    try {
      // Create draft enrollment
      const enrollment: Partial<PayerEnrollment> = {
        payerId,
        clinicianNpi: draftData?.clinicianNpi || '',
        productLines: selectedProductLines,
        status: 'draft',
        // Include prepopulated and filled data
      };

      const created = await submitEnrollment(enrollment);

      // Upload documents
      for (const [docType, file] of Object.entries(uploadedFiles)) {
        await uploadEvidence(created.id, file, docType);
      }

      toast({
        title: 'Draft Created',
        description: 'Your enrollment draft has been saved successfully.'
      });

      // Navigate to enrollment detail
      router.push(`/dashboard/payer/${created.id}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save enrollment draft. Please try again.',
        variant: 'destructive'
      });
      console.error('Failed to submit enrollment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
          <header className="border-b bg-white/80 backdrop-blur-sm">
            <div className="container mx-auto px-4 py-4">
              <Link href="/dashboard" className="flex items-center space-x-2">
                <Shield className="h-8 w-8 text-blue-600" />
                <span className="text-2xl font-bold text-gray-900">VitalCV</span>
              </Link>
            </div>
          </header>

          <main className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="space-y-6">
              <Skeleton className="h-10 w-64" />
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </AuthGuard>
    );
  }

  if (!draftData) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
          <header className="border-b bg-white/80 backdrop-blur-sm">
            <div className="container mx-auto px-4 py-4">
              <Link href="/dashboard" className="flex items-center space-x-2">
                <Shield className="h-8 w-8 text-blue-600" />
                <span className="text-2xl font-bold text-gray-900">VitalCV</span>
              </Link>
            </div>
          </header>

          <main className="container mx-auto px-4 py-8 max-w-4xl">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Failed to load enrollment draft data.
              </AlertDescription>
            </Alert>
          </main>
        </div>
      </AuthGuard>
    );
  }

  const productLineOptions: ProductLine[] = [
    'medical',
    'behavioral',
    'telehealth',
    'urgent_care',
    'specialty',
    'primary_care'
  ];

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
        {/* Header */}
        <header className="border-b bg-white/80 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">VitalCV</span>
            </Link>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Back Button */}
          <Link href="/dashboard/payer/start">
            <Button variant="ghost" className="mb-6 flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Payer Selection
            </Button>
          </Link>

          {/* Page Title */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Start Enrollment
            </h1>
            <p className="text-lg text-gray-600">
              Complete the form below to create your enrollment draft
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Prepopulated Data Alert */}
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Data Prepopulated</AlertTitle>
              <AlertDescription>
                We've automatically filled in information from your CAQH profile and VitalCV credentials
                to save you time.
              </AlertDescription>
            </Alert>

            {/* Product Lines */}
            <Card>
              <CardHeader>
                <CardTitle>Product Lines</CardTitle>
                <CardDescription>
                  Select the service types you want to provide under this enrollment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {productLineOptions.map((line) => (
                    <div key={line} className="flex items-center space-x-2">
                      <Checkbox
                        id={`line-${line}`}
                        checked={selectedProductLines.includes(line)}
                        onCheckedChange={() => handleToggleProductLine(line)}
                        aria-label={`Select ${line.replace('_', ' ')} product line`}
                      />
                      <Label
                        htmlFor={`line-${line}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize cursor-pointer"
                      >
                        {line.replace('_', ' ')}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Prepopulated from CAQH */}
            {draftData.prepopulated.fromCaqh.attestationDate && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    CAQH Data
                  </CardTitle>
                  <CardDescription>
                    Information from your CAQH profile
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Attestation Date:</span>
                      <span className="font-medium">
                        {new Date(draftData.prepopulated.fromCaqh.attestationDate).toLocaleDateString()}
                      </span>
                    </div>
                    {draftData.prepopulated.fromCaqh.licenses && (
                      <div>
                        <span className="text-gray-600">Licenses:</span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {draftData.prepopulated.fromCaqh.licenses.map((license: any, idx: number) => (
                            <Badge key={idx} variant="outline">
                              {license.state || `License ${idx + 1}`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Prepopulated from VitalCV */}
            {draftData.prepopulated.fromVitalCV.credentials && draftData.prepopulated.fromVitalCV.credentials.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    VitalCV Credentials
                  </CardTitle>
                  <CardDescription>
                    Verified credentials from your VitalCV wallet
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {draftData.prepopulated.fromVitalCV.credentials.map((credId, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <Shield className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-mono">{credId}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Missing Required Fields */}
            {draftData.missingItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    Additional Information Required
                  </CardTitle>
                  <CardDescription>
                    Please provide the following information to complete your enrollment
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {draftData.missingItems.map((item) => (
                    <div key={item.field}>
                      <Label htmlFor={item.field} className="flex items-center gap-2 mb-2">
                        {item.label}
                        {item.required && (
                          <span className="text-red-600 text-sm">*</span>
                        )}
                      </Label>

                      {item.type === 'text' && (
                        <Input
                          id={item.field}
                          type="text"
                          required={item.required}
                          value={missingFieldValues[item.field] || ''}
                          onChange={(e) => handleFieldChange(item.field, e.target.value)}
                          aria-required={item.required}
                        />
                      )}

                      {item.type === 'date' && (
                        <Input
                          id={item.field}
                          type="date"
                          required={item.required}
                          value={missingFieldValues[item.field] || ''}
                          onChange={(e) => handleFieldChange(item.field, e.target.value)}
                          aria-required={item.required}
                        />
                      )}

                      {item.type === 'document' && (
                        <div className="flex items-center gap-2">
                          <Input
                            id={item.field}
                            type="file"
                            required={item.required}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(item.field, file);
                            }}
                            aria-required={item.required}
                          />
                          {uploadedFiles[item.field] && (
                            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Required Documents */}
            {draftData.requiredDocuments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-blue-600" />
                    Required Documents
                  </CardTitle>
                  <CardDescription>
                    Upload the following documents to support your enrollment
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {draftData.requiredDocuments.map((docType) => (
                    <div key={docType}>
                      <Label htmlFor={`doc-${docType}`} className="mb-2 capitalize">
                        {docType.replace('_', ' ')}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={`doc-${docType}`}
                          type="file"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(docType, file);
                          }}
                        />
                        {uploadedFiles[docType] && (
                          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-4">
              <Link href="/dashboard/payer">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>

              <Button
                type="submit"
                disabled={submitting || selectedProductLines.length === 0}
                className="flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating Draft...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Create Draft
                  </>
                )}
              </Button>
            </div>
          </form>
        </main>
      </div>
    </AuthGuard>
  );
}

