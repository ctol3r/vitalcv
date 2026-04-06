'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { usePostHog } from 'posthog-js/react';

export function NpiLookupInput() {
  const router = useRouter();
  const posthog = usePostHog();
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
    
    // Track NPI submission event
    posthog?.capture('NPI_Submitted', { npi: trimmed });
    
    router.push(`/readiness?npi=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 max-w-md">
      <div className="relative flex-1">
        <Input
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={10}
          placeholder="Enter NPI number"
          value={npi}
          onChange={(e) => {
            setNpi(e.target.value.replace(/\D/g, ''));
            if (error) setError('');
          }}
          aria-invalid={!!error}
          aria-describedby={error ? 'npi-error' : undefined}
          className="pr-3"
        />
        {error && (
          <p id="npi-error" className="absolute -bottom-5 left-0 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
      <Button type="submit" size="sm" variant="outline" className="shrink-0 gap-1.5">
        Verify
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </form>
  );
}
