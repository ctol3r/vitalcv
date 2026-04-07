'use client';

import { useState, useCallback } from 'react';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

export function ContactForm() {
  const [state, setState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    setState('submitting');
    setErrorMsg('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.get('name'),
          email: data.get('email'),
          message: data.get('message'),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      setState('success');
      form.reset();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
      setState('error');
    }
  }, []);

  if (state === 'success') {
    return (
      <div className="rounded-lg border border-border p-6">
        <p className="text-sm font-semibold text-foreground">Message sent</p>
        <p className="mt-2 text-sm text-muted">
          We&apos;ll get back to you at the email you provided.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="contact-name" className="block text-sm font-medium text-foreground mb-1">
          Name
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          required
          autoComplete="name"
          placeholder="Your name"
          className="w-full rounded-lg border border-border bg-transparent px-4 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-foreground focus:ring-1 focus:ring-foreground"
        />
      </div>

      <div>
        <label htmlFor="contact-email" className="block text-sm font-medium text-foreground mb-1">
          Email
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="your@email.com"
          className="w-full rounded-lg border border-border bg-transparent px-4 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-foreground focus:ring-1 focus:ring-foreground"
        />
      </div>

      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium text-foreground mb-1">
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={4}
          placeholder="What are you working on?"
          className="w-full rounded-lg border border-border bg-transparent px-4 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-foreground focus:ring-1 focus:ring-foreground resize-none"
        />
      </div>

      {state === 'error' && (
        <p role="alert" className="text-sm text-red-500">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={state === 'submitting'}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-theme hover:opacity-90 disabled:opacity-50"
      >
        {state === 'submitting' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
