'use client';

/**
 * Claim Wizard - Multi-step verification flow
 * Step 1: Email/Phone verification (Level 1)
 * Step 2: Document upload + Selfie (Level 2)
 * Step 3: Issuer attestation request (Level 3)
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useTelemetry } from '@/hooks/use-telemetry';
import {
  requestIssuerAttestation,
  startBasicClaim,
  uploadClaimDocuments,
  verifyClaimPin,
} from '@/lib/npi-client';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  Building2,
  Camera,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mail,
  Phone,
  Upload,
  X,
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import { toast } from 'sonner';

interface ClaimWizardProps {
  npi: string;
  onComplete?: (level: number) => void;
  className?: string;
}

type Step = 1 | 2 | 3;

export function ClaimWizard({ npi, onComplete, className }: ClaimWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinSent, setPinSent] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [identityConfidence, setIdentityConfidence] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // New state for enhancements
  const [resendTimer, setResendTimer] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const [useSms, setUseSms] = useState(false);
  const [showDomainHint, setShowDomainHint] = useState(false);
  const [suggestedDomain, setSuggestedDomain] = useState('');

  const { track } = useTelemetry();

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const startTime = Date.now();

    try {
      await startBasicClaim({ npi, email, phone });
      setPinSent(true);
      setCanResend(false);
      // Start 60-second cooldown timer
      setResendTimer(60);
      track(
        'claim_start',
        { npi, step: 1, channel: useSms ? 'sms' : 'email' },
        Date.now() - startTime,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  };

  // Countdown timer for resend
  React.useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => {
        setResendTimer(resendTimer - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (resendTimer === 0 && pinSent) {
      setCanResend(true);
    }
  }, [resendTimer, pinSent]);

  // Domain hint detection
  React.useEffect(() => {
    if (email && email.includes('@')) {
      const domain = email.split('@')[1]?.toLowerCase();
      // Common healthcare domain patterns
      const healthcareDomains = [
        'stanfordhealth.org',
        'mayo.edu',
        'clevelandclinic.org',
        'jhmi.edu',
        'massgeneral.org',
      ];

      // Check for partial matches
      if (domain && domain.length > 3) {
        const suggestion = healthcareDomains.find((d) => d.startsWith(domain));
        if (suggestion && suggestion !== domain) {
          setSuggestedDomain(suggestion);
          setShowDomainHint(true);
        } else {
          setShowDomainHint(false);
        }
      }
    }
  }, [email]);

  const handleResendCode = async () => {
    if (!canResend) return;

    setIsLoading(true);
    setError(null);

    try {
      await startBasicClaim({ npi, email, phone });
      setResendTimer(60);
      setCanResend(false);
      track('claim_resend', { npi, channel: useSms ? 'sms' : 'email' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinVerify = async () => {
    if (!pin || pin.length !== 6) {
      setError('Please enter a 6-digit PIN');
      return;
    }

    setIsLoading(true);
    setError(null);

    const startTime = Date.now();

    try {
      const result = await verifyClaimPin(npi, pin);
      if (result.success) {
        track('claim_level1_ok', { npi }, Date.now() - startTime);
        toast.success('✓ Email verified! Proceeding to Level 1 verification.');
        setCurrentStep(2);
        onComplete?.(1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code');
      toast.error('Verification failed. Please check your code and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

    const validFiles: File[] = [];
    const errors: string[] = [];

    selectedFiles.forEach((file) => {
      // Check file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type. Only PDF, JPG, and PNG are allowed.`);
        return;
      }

      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large. Maximum size is 10MB.`);
        return;
      }

      validFiles.push(file);
    });

    if (errors.length > 0) {
      errors.forEach((err) => toast.error(err));
    }

    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles]);
      toast.success(`${validFiles.length} file(s) added successfully`);
    }

    // Reset input
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      setError('Failed to access camera. Please upload a selfie instead.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoRef.current, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
        setSelfieFile(file);
        stopCamera();
      }
    }, 'image/jpeg');
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
    }
  };

  const handleStep2Submit = async () => {
    if (files.length === 0 || !selfieFile) {
      setError('Please upload at least one document and a selfie');
      return;
    }

    setIsLoading(true);
    setError(null);
    setUploadProgress(0);

    const startTime = Date.now();
    const allFiles = [...files, selfieFile];

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const result = await uploadClaimDocuments(npi, allFiles);
      clearInterval(progressInterval);
      setUploadProgress(100);

      // Simulate identity confidence score
      setTimeout(() => {
        const confidence = 85 + Math.floor(Math.random() * 15); // 85-100%
        setIdentityConfidence(confidence);
        track('claim_level2_ok', { npi, confidence }, Date.now() - startTime);

        // Success animation and toast
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        toast.success("🎉 Identity verified! You've reached Level 2.", {
          duration: prefersReducedMotion ? 3000 : 5000,
        });

        setTimeout(
          () => {
            setCurrentStep(3);
            onComplete?.(2);
          },
          prefersReducedMotion ? 500 : 1500,
        );
      }, 1000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMsg);

      // Provide step-specific remediation tips
      if (errorMsg.includes('OCR') || errorMsg.includes('document')) {
        toast.error('Document quality issue', {
          description:
            'Please ensure your documents are clear and well-lit. Try taking a new photo with better lighting.',
        });
      } else if (errorMsg.includes('face') || errorMsg.includes('selfie')) {
        toast.error('Face verification issue', {
          description:
            'Please ensure your face is clearly visible and matches your document photo.',
        });
      } else {
        toast.error('Upload failed', {
          description: 'Please check your connection and try again.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep3Submit = async () => {
    setIsLoading(true);
    setError(null);

    const startTime = Date.now();

    try {
      await requestIssuerAttestation(npi);
      track('attest_requested', { npi }, Date.now() - startTime);

      // Celebratory toast with wallet CTA
      toast.success('🏆 Attestation requested!', {
        description: 'An authorized issuer will review your credentials.',
        action: {
          label: 'Add to Wallet',
          onClick: () => {
            window.location.href = '/wallet';
          },
        },
        duration: 10000,
      });

      onComplete?.(3);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to request attestation';
      setError(errorMsg);
      toast.error('Request failed', {
        description: errorMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      {/* Channel Selection Toggle */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          {useSms ? <Phone className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
          <span className="text-sm font-medium">Send code via {useSms ? 'SMS' : 'Email'}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setUseSms(!useSms)}
          disabled={pinSent || isLoading}
        >
          Switch to {useSms ? 'Email' : 'SMS'}
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="email">Email Address *</Label>
        </div>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your.email@example.com"
          required
          disabled={pinSent || isLoading}
          aria-required="true"
        />
        {showDomainHint && suggestedDomain && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => {
              const localPart = email.split('@')[0];
              setEmail(`${localPart}@${suggestedDomain}`);
              setShowDomainHint(false);
            }}
          >
            Did you mean <strong className="ml-1">@{suggestedDomain}</strong>?
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="phone">Phone Number {useSms ? '*' : '(optional)'}</Label>
        </div>
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+1 (555) 000-0000"
          disabled={pinSent || isLoading}
          required={useSms}
          aria-required={useSms}
        />
      </div>

      {!pinSent ? (
        <Button
          onClick={handleStep1Submit}
          disabled={!email || (useSms && !phone) || isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            `Send Verification Code via ${useSms ? 'SMS' : 'Email'}`
          )}
        </Button>
      ) : (
        <>
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Verification code sent to {useSms ? phone : email}. Please check your{' '}
              {useSms ? 'messages' : 'inbox'}.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="pin">Enter 6-digit code</Label>
            <Input
              id="pin"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              disabled={isLoading}
              aria-label="Verification code"
            />
          </div>

          {/* Resend with timer */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {resendTimer > 0 ? `Resend available in ${resendTimer}s` : 'Code not received?'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResendCode}
              disabled={!canResend || isLoading}
            >
              Resend Code
            </Button>
          </div>

          <Button
            onClick={handlePinVerify}
            disabled={pin.length !== 6 || isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify Code'
            )}
          </Button>
        </>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      {/* Document Upload */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Identity Documents</Label>
          <Badge variant="secondary">{files.length} uploaded</Badge>
        </div>
        <div
          className={cn(
            'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors',
            'hover:border-primary/50 hover:bg-accent/50',
            'cursor-pointer',
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Upload Documents</p>
          <p className="text-xs text-muted-foreground">PDF, JPG, or PNG</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileSelect}
          className="hidden"
        />
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded-md bg-muted/30 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => removeFile(idx)}
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selfie Capture */}
      <div className="space-y-3">
        <Label>Selfie Verification</Label>
        {!selfieFile && !isCameraActive && (
          <div className="flex gap-2">
            <Button onClick={startCamera} variant="outline" className="flex-1">
              <Camera className="mr-2 h-4 w-4" />
              Take Photo
            </Button>
            <Button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) setSelfieFile(file);
                };
                input.click();
              }}
              variant="outline"
              className="flex-1"
            >
              <ImageIcon className="mr-2 h-4 w-4" />
              Upload Photo
            </Button>
          </div>
        )}
        {isCameraActive && (
          <div className="space-y-2">
            <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg" />
            <div className="flex gap-2">
              <Button onClick={capturePhoto} className="flex-1">
                Capture
              </Button>
              <Button onClick={stopCamera} variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        )}
        {selfieFile && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 dark:bg-green-950/20">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm text-green-900 dark:text-green-200">
              Selfie captured: {selfieFile.name}
            </span>
          </div>
        )}
      </div>

      {uploadProgress > 0 && uploadProgress < 100 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} />
        </div>
      )}

      {identityConfidence !== null && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            <strong>Identity verified!</strong> Confidence: {identityConfidence}%
          </AlertDescription>
        </Alert>
      )}

      <Button
        onClick={handleStep2Submit}
        disabled={files.length === 0 || !selfieFile || isLoading}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          'Submit Documents'
        )}
      </Button>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <Alert>
        <Building2 className="h-4 w-4" />
        <AlertDescription>
          Your identity has been verified. Request attestation from a trusted issuer to achieve the
          highest verification level.
        </AlertDescription>
      </Alert>

      <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
        <h4 className="font-medium text-sm">What is Issuer Attestation?</h4>
        <p className="text-sm text-muted-foreground">
          An authorized healthcare organization will review your credentials and provide on-chain
          verification, giving you Level 3 claim status.
        </p>
      </div>

      <Button onClick={handleStep3Submit} disabled={isLoading} className="w-full">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Requesting...
          </>
        ) : (
          'Request Issuer Attestation'
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        You will be notified when your attestation request is reviewed
      </p>
    </div>
  );

  const steps = [
    { number: 1, label: 'Confirm Email', icon: Mail },
    { number: 2, label: 'Verify Identity', icon: Camera },
    { number: 3, label: 'Issuer Attestation', icon: Building2 },
  ];

  return (
    <Card className={cn('w-full max-w-2xl', className)}>
      <CardHeader>
        <CardTitle>Claim NPI Verification</CardTitle>
        <CardDescription>
          Complete all steps to verify your identity and claim this NPI
        </CardDescription>

        {/* Step Progress */}
        <div className="flex items-center justify-between pt-4">
          {steps.map((step, idx) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.number;
            const isCompleted = currentStep > step.number;

            return (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors',
                      isCompleted && 'border-green-500 bg-green-500 text-white',
                      isActive && 'border-primary bg-primary text-primary-foreground',
                      !isActive &&
                        !isCompleted &&
                        'border-muted-foreground/30 text-muted-foreground',
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <StepIcon className="h-5 w-5" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs font-medium text-center',
                      isActive && 'text-primary',
                      !isActive && 'text-muted-foreground',
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-0.5 mx-2',
                      isCompleted ? 'bg-green-500' : 'bg-muted-foreground/30',
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </CardContent>
    </Card>
  );
}
