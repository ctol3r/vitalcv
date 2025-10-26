'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import {
  startBasicClaim,
  verifyClaimPin,
  uploadClaimDocuments,
  requestIssuerAttestation,
} from '@/lib/npi-client';

const API = process.env.NEXT_PUBLIC_API_BASE || '';

export function ClaimWizardPane({
  npi,
  userId = 'demo_user_cuid',
  holderDid = 'did:vital:demo',
}: {
  npi: string;
  userId?: string;
  holderDid?: string;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [msg, setMsg] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);

  async function handleStartBasic() {
    setBusy(true);
    setStatus('idle');
    try {
      await startBasicClaim({ npi, email });
      setMsg('Verification code sent! Check your email.');
      setStatus('ok');
    } catch (e: any) {
      setStatus('err');
      setMsg(e.message || 'Failed to send verification code');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyPin() {
    setBusy(true);
    setStatus('idle');
    try {
      await verifyClaimPin(npi, pin);
      setStatus('ok');
      setMsg('Email verified! Moving to Level 2.');
      setTimeout(() => setStep(2), 1000);
    } catch (e: any) {
      setStatus('err');
      setMsg(e.message || 'Invalid verification code');
    } finally {
      setBusy(false);
    }
  }

  async function handleDocVerify() {
    setBusy(true);
    setStatus('idle');
    try {
      if (files.length === 0) {
        setStatus('err');
        setMsg('Please select at least one document');
        return;
      }
      await uploadClaimDocuments(npi, files);
      setStatus('ok');
      setMsg('Documents verified! Level 2 complete.');
      setTimeout(() => setStep(3), 1000);
    } catch (e: any) {
      setStatus('err');
      setMsg(e.message || 'Document upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleAttest() {
    setBusy(true);
    setStatus('idle');
    try {
      await requestIssuerAttestation(npi);
      setStatus('ok');
      setMsg('Attestation requested! An issuer will review your request.');
    } catch (e: any) {
      setStatus('err');
      setMsg(e.message || 'Failed to request attestation');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h3 className="text-lg font-semibold">Claim NPI {npi}</h3>
        <p className="text-xs text-neutral-500 mt-1">
          Public lookup ≠ login. This wizard verifies control of the NPI.
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`flex-1 h-1 rounded ${
              s === step
                ? 'bg-blue-600'
                : s < step
                ? 'bg-green-600'
                : 'bg-neutral-200 dark:bg-neutral-800'
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-pane">Email</Label>
            <Input
              id="email-pane"
              type="email"
              placeholder="you@clinic.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <Button onClick={handleStartBasic} disabled={busy || !email} className="w-full">
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending OTP…
              </>
            ) : (
              'Send Verification Code'
            )}
          </Button>

          {status === 'ok' && msg && (
            <div className="mt-4 space-y-3">
              <Label htmlFor="pin-pane">Enter 6-digit PIN</Label>
              <Input
                id="pin-pane"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              />
              <Button
                onClick={handleVerifyPin}
                disabled={busy || pin.length !== 6}
                className="w-full"
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  'Verify PIN'
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
              Upload your medical license and identification documents
            </p>
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="w-full rounded border p-2 text-sm"
            />
            {files.length > 0 && (
              <p className="text-xs text-neutral-500 mt-1">{files.length} file(s) selected</p>
            )}
          </div>

          <Button onClick={handleDocVerify} disabled={busy || files.length === 0} className="w-full">
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying…
              </>
            ) : (
              'Upload & Verify Documents'
            )}
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Your identity has been verified at Level 2. Request attestation from a trusted issuer
              to achieve Level 3 verification.
            </AlertDescription>
          </Alert>

          <Button onClick={handleAttest} disabled={busy} className="w-full">
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Requesting…
              </>
            ) : (
              'Request Issuer Attestation'
            )}
          </Button>
        </div>
      )}

      {status === 'err' && msg && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{msg}</AlertDescription>
        </Alert>
      )}

      {status === 'ok' && msg && step !== 1 && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{msg}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

