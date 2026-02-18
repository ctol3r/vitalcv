'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const router = useRouter();
  const [npi, setNpi] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = npi.trim();
    if (!/^\d{10}$/.test(trimmed)) {
      setError('Enter a valid 10-digit NPI');
      return;
    }
    setError('');
    router.push(`/verify/${trimmed}`);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
            VitalCV
          </h1>
          <p className="text-sm text-neutral-500">
            Verify a provider by NPI
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="text"
              inputMode="numeric"
              pattern="\d*"
              maxLength={10}
              placeholder="NPI number"
              value={npi}
              onChange={(e) => {
                setNpi(e.target.value.replace(/\D/g, ''));
                if (error) setError('');
              }}
              aria-invalid={!!error}
              aria-describedby={error ? 'npi-error' : undefined}
              autoFocus
            />
            {error && (
              <p id="npi-error" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" size="lg">
            Verify
          </Button>
        </form>
      </div>
    </main>
  );
}
