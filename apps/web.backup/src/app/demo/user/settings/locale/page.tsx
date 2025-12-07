/**
 * B230C-INTL-011: Language & Locale Settings UI
 *
 * Allows users and org admins to select language, time zone, and currency preferences.
 * Updates UI and emails instantly; stores preferences in profile.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Loader2, Globe, Clock, DollarSign } from 'lucide-react';

interface LocalePreferences {
  language: string;
  timezone: string;
  currency: string;
}

// Common languages with region codes
const LANGUAGES = [
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'es-ES', label: 'Español (España)' },
  { value: 'es-MX', label: 'Español (México)' },
  { value: 'fr-FR', label: 'Français (France)' },
  { value: 'de-DE', label: 'Deutsch (Deutschland)' },
  { value: 'it-IT', label: 'Italiano (Italia)' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'zh-CN', label: '中文 (简体)' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'ko-KR', label: '한국어' },
];

// Common timezones
const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { value: 'America/Toronto', label: 'Toronto' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Europe/Madrid', label: 'Madrid' },
  { value: 'Europe/Rome', label: 'Rome' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Shanghai', label: 'Shanghai' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong' },
  { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Australia/Sydney', label: 'Sydney' },
];

// Common currencies
const CURRENCIES = [
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
  { value: 'JPY', label: 'Japanese Yen (JPY)' },
  { value: 'CNY', label: 'Chinese Yuan (CNY)' },
  { value: 'CAD', label: 'Canadian Dollar (CAD)' },
  { value: 'AUD', label: 'Australian Dollar (AUD)' },
  { value: 'CHF', label: 'Swiss Franc (CHF)' },
  { value: 'MXN', label: 'Mexican Peso (MXN)' },
  { value: 'BRL', label: 'Brazilian Real (BRL)' },
  { value: 'INR', label: 'Indian Rupee (INR)' },
  { value: 'KRW', label: 'South Korean Won (KRW)' },
];

export default function LocaleSettingsPage() {
  const [preferences, setPreferences] = useState<LocalePreferences>({
    language: 'en-US',
    timezone: 'UTC',
    currency: 'USD',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  async function loadPreferences() {
    try {
      setLoading(true);
      const res = await fetch('/api/demo/user/settings/locale');
      if (!res.ok) throw new Error('Failed to load preferences');
      const data = await res.json();
      setPreferences({
        language: data.language || 'en-US',
        timezone: data.timezone || 'UTC',
        currency: data.currency || 'USD',
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
      // Use defaults on error
    } finally {
      setLoading(false);
    }
  }

  async function savePreferences() {
    try {
      setSaving(true);
      setSuccess(false);
      setError(null);

      const res = await fetch('/api/demo/user/settings/locale', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save preferences');
      }

      setSuccess(true);

      // Update document language attribute
      if (typeof document !== 'undefined') {
        document.documentElement.lang = preferences.language;
      }

      // Update localStorage for instant UI updates
      localStorage.setItem('user_language', preferences.language);
      localStorage.setItem('user_timezone', preferences.timezone);
      localStorage.setItem('user_currency', preferences.currency);

      // Trigger a custom event for other components to listen to
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('locale-changed', { detail: preferences }));
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  }

  function handleLanguageChange(value: string) {
    setPreferences((prev) => ({ ...prev, language: value }));
    setSuccess(false);
  }

  function handleTimezoneChange(value: string) {
    setPreferences((prev) => ({ ...prev, timezone: value }));
    setSuccess(false);
  }

  function handleCurrencyChange(value: string) {
    setPreferences((prev) => ({ ...prev, currency: value }));
    setSuccess(false);
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Language & Locale Settings</h1>
        <p className="text-muted-foreground">
          Customize your language, time zone, and currency preferences. Changes apply immediately to the UI and emails.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Preferences saved successfully! Changes are now active.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {/* Language Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              <CardTitle>Language</CardTitle>
            </div>
            <CardDescription>
              Select your preferred language for the user interface and email communications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="language">Interface Language</Label>
              <Select value={preferences.language} onValueChange={handleLanguageChange}>
                <SelectTrigger id="language">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Timezone Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <CardTitle>Time Zone</CardTitle>
            </div>
            <CardDescription>
              Set your time zone to display dates and times in your local time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="timezone">Time Zone</Label>
              <Select value={preferences.timezone} onValueChange={handleTimezoneChange}>
                <SelectTrigger id="timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Currency Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              <CardTitle>Currency</CardTitle>
            </div>
            <CardDescription>
              Choose your preferred currency for displaying prices and financial information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={preferences.currency} onValueChange={handleCurrencyChange}>
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((curr) => (
                    <SelectItem key={curr.value} value={curr.value}>
                      {curr.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-4">
          <Button
            onClick={savePreferences}
            disabled={saving}
            className="min-w-[120px]"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Preferences'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

