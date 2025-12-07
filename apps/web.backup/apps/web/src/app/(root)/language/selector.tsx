'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { localeOptions } from '@/lib/i18n-locales';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function LanguageSelector({ initialLocale }: { initialLocale: string }) {
  const [locale, setLocale] = useState(initialLocale);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function persist() {
    setSaving(true);
    setStatus(null);
    try {
      document.cookie = `vitalcv_locale=${locale}; path=/; max-age=31536000`;
      await fetch('/api/demo/preferences/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale, userId: 'demo-user' }),
      });
      setStatus('Preference saved');
      router.refresh();
    } catch (error) {
      console.warn('[language][preferences]', error);
      setStatus('Unable to persist preference. Try again later.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Profile</Badge>
        <h1 className="text-3xl font-semibold">Language preferences</h1>
        <p className="text-muted-foreground">
          Choose your preferred language. We store the selection in cookies and sync it with your
          profile.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Available languages</CardTitle>
          <CardDescription>Pick one option below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {localeOptions.map((option) => (
            <label
              key={option.code}
              className="flex cursor-pointer items-center justify-between rounded border px-3 py-2 hover:bg-muted/40"
            >
              <div>
                <p className="font-medium">{option.label}</p>
                <p className="text-sm text-muted-foreground">{option.nativeLabel}</p>
              </div>
              <input
                type="radio"
                name="locale"
                value={option.code}
                checked={locale === option.code}
                onChange={() => setLocale(option.code)}
                className="h-4 w-4 accent-primary"
              />
            </label>
          ))}
          {status && <p className="text-sm text-muted-foreground">{status}</p>}
          <Button className="w-full" onClick={persist} disabled={saving}>
            {saving ? 'Saving…' : 'Save preference'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

