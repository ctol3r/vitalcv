/**
 * Issuer Credential Wizard
 * Multi-step wizard for issuing credentials with OCR pre-fill
 */

'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Loader2,
  Shield,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface CredentialData {
  type: string;
  subjectId: string;
  claims: Record<string, any>;
  expiresAt?: string;
  schemaId?: string;
}

const CREDENTIAL_TYPES = [
  { value: 'MedicalLicense', label: 'Medical License' },
  { value: 'BoardCertification', label: 'Board Certification' },
  { value: 'EmploymentCredential', label: 'Employment Credential' },
  { value: 'EducationCredential', label: 'Education Credential' },
];

const STEPS = [
  { id: 1, name: 'Upload Document', description: 'Upload credential documentation' },
  { id: 2, name: 'Extract Data', description: 'AI extracts information' },
  { id: 3, name: 'Review & Confirm', description: 'Verify extracted data' },
  { id: 4, name: 'Issue Credential', description: 'Generate and sign credential' },
];

export default function IssuerWizardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [credentialData, setCredentialData] = useState<CredentialData>({
    type: 'MedicalLicense',
    subjectId: '',
    claims: {},
  });
  const [extractedData, setExtractedData] = useState<any>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);

  const progress = (currentStep / STEPS.length) * 100;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setUploading(true);

    try {
      // Upload file to server
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/issuer/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      setUploadedFileUrl(data.fileUrl);

      toast({
        title: 'Success',
        description: 'Document uploaded successfully',
      });

      // Auto-advance to next step
      setTimeout(() => {
        setCurrentStep(2);
        handleOCRExtraction(data.fileUrl);
      }, 500);
    } catch (error) {
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload document. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleOCRExtraction = async (fileUrl: string) => {
    setExtracting(true);

    try {
      const response = await fetch('/api/issuer/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl, credentialType: credentialData.type }),
      });

      if (!response.ok) throw new Error('Extraction failed');

      const data = await response.json();
      setExtractedData(data);

      // Pre-fill credential data
      setCredentialData((prev) => ({
        ...prev,
        subjectId: data.subjectId || '',
        claims: data.claims || {},
        expiresAt: data.expiresAt,
      }));

      toast({
        title: 'Data Extracted',
        description: 'AI successfully extracted credential information',
      });
    } catch (error) {
      toast({
        title: 'Extraction Failed',
        description: 'Failed to extract data. You can enter it manually.',
        variant: 'destructive',
      });
      // Still allow manual entry
      setExtractedData({ confidence: 0 });
    } finally {
      setExtracting(false);
    }
  };

  const handleIssueCredential = async () => {
    setIssuing(true);

    try {
      const response = await fetch('/api/issuer/credential', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentialData),
      });

      if (!response.ok) throw new Error('Issuance failed');

      const data = await response.json();

      toast({
        title: 'Credential Issued',
        description: `Credential ${data.credentialId} issued successfully`,
      });

      // Store issued credential info
      localStorage.setItem(
        'vitalcv_last_issued',
        JSON.stringify({
          credentialId: data.credentialId,
          type: credentialData.type,
          timestamp: new Date().toISOString(),
          issuer: 'Your Organization',
        }),
      );

      // Advance to success step
      setCurrentStep(5);

      // Redirect after delay
      setTimeout(() => {
        router.push(`/wallet/${data.credentialId}`);
      }, 2000);
    } catch (error) {
      toast({
        title: 'Issuance Failed',
        description: 'Failed to issue credential. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIssuing(false);
    }
  };

  const updateClaim = (key: string, value: any) => {
    setCredentialData((prev) => ({
      ...prev,
      claims: {
        ...prev.claims,
        [key]: value,
      },
    }));
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">Issue Credential</h1>
        <p className="text-lg text-muted-foreground">
          Follow the steps to issue a verifiable credential
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <Progress value={progress} className="mb-4" />
        <div className="grid grid-cols-4 gap-2">
          {STEPS.map((step) => (
            <div
              key={step.id}
              className={cn('text-center', currentStep >= step.id ? 'opacity-100' : 'opacity-50')}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-sm font-semibold',
                  currentStep > step.id
                    ? 'bg-green-500 text-white'
                    : currentStep === step.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
              </div>
              <div className="text-xs font-medium">{step.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStep - 1]?.name}</CardTitle>
          <CardDescription>{STEPS[currentStep - 1]?.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step 1: Upload Document */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <Label>Credential Type</Label>
                <Select
                  value={credentialData.type}
                  onValueChange={(value) => setCredentialData((prev) => ({ ...prev, type: value }))}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CREDENTIAL_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div>
                <Label>Upload Supporting Document</Label>
                <div className="mt-2 border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept="image/*,.pdf"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-12 w-12 text-muted-foreground mb-4 animate-spin" />
                        <p className="text-sm text-muted-foreground">Uploading...</p>
                      </>
                    ) : file ? (
                      <>
                        <FileText className="h-12 w-12 text-green-500 mb-4" />
                        <p className="text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-sm font-medium">Click to upload document</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          PDF, PNG, JPG up to 10MB
                        </p>
                      </>
                    )}
                  </label>
                </div>
              </div>

              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertDescription>
                  Our AI will automatically extract credential information from your document
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Step 2: Extract Data */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {extracting ? (
                <div className="text-center py-12">
                  <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
                  <h3 className="text-lg font-semibold mb-2">Extracting Data...</h3>
                  <p className="text-sm text-muted-foreground">AI is analyzing your document</p>
                </div>
              ) : extractedData ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
                    <div className="flex items-center gap-3">
                      <Check className="h-5 w-5 text-green-600" />
                      <div>
                        <div className="font-semibold">Extraction Complete</div>
                        <div className="text-sm text-muted-foreground">
                          Confidence: {((extractedData.confidence || 0) * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-white">
                      AI Assisted
                    </Badge>
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Review the extracted data in the next step and make any necessary corrections
                    </AlertDescription>
                  </Alert>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setCurrentStep(1)} className="flex-1">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button onClick={() => setCurrentStep(3)} className="flex-1">
                      Review Data
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Step 3: Review & Confirm */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <Label>Subject DID / Identifier</Label>
                <Input
                  value={credentialData.subjectId}
                  onChange={(e) =>
                    setCredentialData((prev) => ({ ...prev, subjectId: e.target.value }))
                  }
                  placeholder="did:example:123 or email@example.com"
                  className="mt-2"
                />
              </div>

              <Separator />

              <div>
                <Label className="text-base font-semibold mb-4 block">Credential Claims</Label>
                <div className="space-y-4">
                  {credentialData.type === 'MedicalLicense' && (
                    <>
                      <div>
                        <Label>License Number</Label>
                        <Input
                          value={credentialData.claims.licenseNumber || ''}
                          onChange={(e) => updateClaim('licenseNumber', e.target.value)}
                          placeholder="CA-12345"
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label>Specialty</Label>
                        <Input
                          value={credentialData.claims.specialty || ''}
                          onChange={(e) => updateClaim('specialty', e.target.value)}
                          placeholder="Internal Medicine"
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label>NPI</Label>
                        <Input
                          value={credentialData.claims.npi || ''}
                          onChange={(e) => updateClaim('npi', e.target.value)}
                          placeholder="1234567890"
                          className="mt-2"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <Label>Additional Claims (JSON)</Label>
                    <Textarea
                      value={JSON.stringify(credentialData.claims, null, 2)}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value);
                          setCredentialData((prev) => ({ ...prev, claims: parsed }));
                        } catch (error) {
                          // Invalid JSON, ignore
                        }
                      }}
                      className="mt-2 font-mono text-xs"
                      rows={6}
                    />
                  </div>

                  <div>
                    <Label>Expiration Date (Optional)</Label>
                    <Input
                      type="date"
                      value={credentialData.expiresAt?.split('T')[0] || ''}
                      onChange={(e) =>
                        setCredentialData((prev) => ({
                          ...prev,
                          expiresAt: e.target.value
                            ? new Date(e.target.value).toISOString()
                            : undefined,
                        }))
                      }
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setCurrentStep(2)} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={() => setCurrentStep(4)} className="flex-1">
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Issue Credential */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Ready to Issue</strong>
                  <br />
                  The credential will be cryptographically signed and anchored on-chain.
                </AlertDescription>
              </Alert>

              <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium">{credentialData.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subject:</span>
                  <span className="font-mono text-xs">{credentialData.subjectId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Claims:</span>
                  <span className="font-medium">
                    {Object.keys(credentialData.claims).length} fields
                  </span>
                </div>
                {credentialData.expiresAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expires:</span>
                    <span className="font-medium">
                      {new Date(credentialData.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setCurrentStep(3)} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleIssueCredential}
                  disabled={issuing || !credentialData.subjectId}
                  className="flex-1"
                >
                  {issuing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Issuing...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      Issue Credential
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Success */}
          {currentStep === 5 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Credential Issued Successfully!</h3>
              <p className="text-muted-foreground mb-6">
                The credential has been signed and anchored on-chain
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => router.push('/issuer')}>
                  Issue Another
                </Button>
                <Button onClick={() => router.push('/wallet')}>View in Wallet</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
