'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function RequestPilotForm() {
  const [email, setEmail] = React.useState('');
  const [status, setStatus] = React.useState<'idle' | 'submitting' | 'success'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('submitting');
    
    // Simulate API call
    setTimeout(() => {
      setStatus('success');
      setEmail('');
    }, 1000);
  };

  if (status === 'success') {
    return (
      <div className="rounded-lg bg-green-50 p-6 text-green-900 border border-green-200">
        <h3 className="font-semibold mb-2">Request Received!</h3>
        <p>Thanks for your interest. We'll be in touch shortly.</p>
        <Button 
          variant="link" 
          className="px-0 text-green-700 mt-2 h-auto"
          onClick={() => setStatus('idle')}
        >
          Request another
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="space-y-2 text-left">
          <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Work Email
          </label>
          <Input
            id="email"
            type="email"
            placeholder="name@organization.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'submitting'}
            required
            className="bg-white"
          />
        </div>
        <Button type="submit" disabled={status === 'submitting'} className="w-full">
          {status === 'submitting' ? 'Requesting...' : 'Request Pilot'}
        </Button>
      </form>
      <p className="text-xs text-slate-500 mt-4 text-center">
        Limited availability for Q1 2026 pilots.
      </p>
    </div>
  );
}
