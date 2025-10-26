'use client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function StartPage() {
  const [npi, setNpi] = useState('');
  const [err, setErr] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const router = useRouter();

  // Debounced validation
  useEffect(() => {
    if (npi.length === 0) {
      setErr('');
      setIsValid(false);
      setIsValidating(false);
      return;
    }

    setIsValidating(true);
    const timer = setTimeout(() => {
      if (!/^\d{10}$/.test(npi)) {
        setErr('NPI must be exactly 10 digits');
        setIsValid(false);
      } else {
        setErr('');
        setIsValid(true);
      }
      setIsValidating(false);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [npi]);

  const handleNpiChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setNpi(value);
  }, []);

  const formatNpiDisplay = (value: string): string => {
    if (value.length <= 3) return value;
    if (value.length <= 6) return `${value.slice(0, 3)}-${value.slice(3)}`;
    return `${value.slice(0, 3)}-${value.slice(3, 6)}-${value.slice(6)}`;
  };

  function go() {
    if (!isValid) {
      setErr('Enter a valid 10-digit NPI');
      return;
    }
    router.push(`/npi/${npi}?auto=1`);
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid) {
      go();
    }
  };

  return (
    <main className="grid min-h-[70vh] place-items-center p-6">
      {/* Global Banner */}
      <Alert className="absolute top-4 left-1/2 -translate-x-1/2 max-w-2xl" variant="default">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Note:</strong> Public NPI lookup ≠ identity verification. Claiming verifies your
          identity in steps (L0–L3).
        </AlertDescription>
      </Alert>

      <div className="w-full max-w-md rounded-xl border p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold">Welcome to VitalCV</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Enter your 10-digit National Provider Identifier (NPI) to begin. This will look up your
          public NPPES record and allow you to claim ownership.
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="npi-input">National Provider Identifier (NPI)</Label>
            <div className="relative">
              <Input
                id="npi-input"
                inputMode="numeric"
                pattern="\d{10}"
                value={npi}
                onChange={handleNpiChange}
                onKeyDown={handleKeyDown}
                placeholder="1234567890"
                className="pr-10"
                aria-invalid={!!err}
                aria-describedby={err ? 'npi-error' : undefined}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isValidating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {!isValidating && isValid && <CheckCircle2 className="h-4 w-4 text-green-600" />}
              </div>
            </div>
            {npi && (
              <p className="text-xs text-muted-foreground">Formatted: {formatNpiDisplay(npi)}</p>
            )}
            {err && (
              <p id="npi-error" className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {err}
              </p>
            )}
          </div>

          <Button onClick={go} disabled={!isValid || isValidating} className="w-full" size="lg">
            Continue to NPI Profile
          </Button>
        </div>

        <div className="mt-6 p-4 rounded-lg bg-muted/50 space-y-2">
          <h3 className="text-xs font-semibold">What happens next?</h3>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>View public NPPES information</li>
            <li>Claim ownership through verification (L1-L3)</li>
            <li>Receive verifiable credentials</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
