/**
 * B252C-I18N-023: TranslationEditor UI
 *
 * UI for editing a translation key across languages: shows default message and
 * translation fields for each enabled language; includes validation for missing
 * required translations; accessible form
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Save,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

interface TranslationEntry {
  languageCode: string;
  languageName: string;
  translation: string;
  isRequired: boolean;
}

interface TranslationKey {
  id: string;
  key: string;
  namespace: string;
  defaultMessage: string;
  description?: string;
  translations: TranslationEntry[];
}

export default function TranslationEditorPage() {
  const params = useParams();
  const router = useRouter();
  const keyId = params.keyId as string;

  const [translationKey, setTranslationKey] = useState<TranslationKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchTranslationKey();
  }, [keyId]);

  const fetchTranslationKey = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/i18n/keys/${keyId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch translation key');
      }
      const data = await response.json();
      setTranslationKey(data);

      // Initialize translations state
      const initialTranslations: Record<string, string> = {};
      data.translations.forEach((entry: TranslationEntry) => {
        initialTranslations[entry.languageCode] = entry.translation;
      });
      setTranslations(initialTranslations);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTranslationChange = (languageCode: string, value: string) => {
    setTranslations((prev) => ({
      ...prev,
      [languageCode]: value,
    }));

    // Clear validation error for this language
    if (validationErrors[languageCode]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[languageCode];
        return next;
      });
    }
  };

  const validateTranslations = (): boolean => {
    if (!translationKey) return false;

    const errors: Record<string, string> = {};

    translationKey.translations.forEach((entry) => {
      if (entry.isRequired && !translations[entry.languageCode]?.trim()) {
        errors[entry.languageCode] = 'This translation is required';
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!translationKey) return;

    if (!validateTranslations()) {
      setError('Please fix validation errors before saving');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const response = await fetch(`/api/admin/i18n/keys/${keyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          translations,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save translations');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (!translationKey) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Translation key not found
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/admin/i18n/keys')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Keys
        </Button>
        <h1 className="text-3xl font-bold mb-2">Edit Translation</h1>
        <p className="text-gray-600">Edit translations for key: {translationKey.key}</p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Success</AlertTitle>
          <AlertDescription className="text-green-700">
            Translations saved successfully
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Translation Key Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Key</Label>
              <Input value={translationKey.key} disabled />
            </div>
            <div>
              <Label>Namespace</Label>
              <Input value={translationKey.namespace} disabled />
            </div>
            <div>
              <Label>Default Message</Label>
              <Textarea value={translationKey.defaultMessage} disabled rows={3} />
            </div>
            {translationKey.description && (
              <div>
                <Label>Description</Label>
                <p className="text-sm text-muted-foreground">
                  {translationKey.description}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Translations</CardTitle>
          <CardDescription>
            Edit translations for each enabled language
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {translationKey.translations.map((entry) => (
              <div key={entry.languageCode} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`translation-${entry.languageCode}`}>
                    {entry.languageName} ({entry.languageCode})
                    {entry.isRequired && (
                      <Badge variant="destructive" className="ml-2">
                        Required
                      </Badge>
                    )}
                  </Label>
                </div>
                <Textarea
                  id={`translation-${entry.languageCode}`}
                  value={translations[entry.languageCode] || ''}
                  onChange={(e) =>
                    handleTranslationChange(entry.languageCode, e.target.value)
                  }
                  rows={3}
                  className={validationErrors[entry.languageCode] ? 'border-destructive' : ''}
                  aria-invalid={!!validationErrors[entry.languageCode]}
                  aria-describedby={
                    validationErrors[entry.languageCode]
                      ? `error-${entry.languageCode}`
                      : undefined
                  }
                />
                {validationErrors[entry.languageCode] && (
                  <p
                    id={`error-${entry.languageCode}`}
                    className="text-sm text-destructive"
                    role="alert"
                  >
                    {validationErrors[entry.languageCode]}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/admin/i18n/keys')}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Translations
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

