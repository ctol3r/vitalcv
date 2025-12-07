/**
 * B241C-I18N-021: LocalisationEditor UI
 *
 * Provides interface for translators and admins to edit translation entries:
 * - Shows key, default text, multiple locales side by side
 * - Allows inline editing
 * - Search/filter functionality
 * - Export capabilities
 * - Validates placeholders
 * - Indicates missing translations
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import { Search, Download, Save, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useTranslation, type Locale } from '@/i18n';
import { cn } from '@/lib/utils';

export interface TranslationEntry {
  key: string;
  defaultText: string;
  translations: Record<Locale, string>;
  namespace?: string;
}

interface LocalisationEditorProps {
  entries: TranslationEntry[];
  locales?: Locale[];
  onSave?: (entry: TranslationEntry) => Promise<void>;
  onExport?: (format: 'json' | 'csv') => void;
  className?: string;
}

export function LocalisationEditor({
  entries: initialEntries,
  locales,
  onSave,
  onExport,
  className,
}: LocalisationEditorProps) {
  const { locale: currentLocale, i18n } = useTranslation();
  const availableLocales = locales || (i18n.languages as Locale[]);
  const [entries, setEntries] = useState<TranslationEntry[]>(initialEntries);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingLocale, setEditingLocale] = useState<Locale | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Filter entries based on search
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const query = searchQuery.toLowerCase();
    return entries.filter(
      (entry) =>
        entry.key.toLowerCase().includes(query) ||
        entry.defaultText.toLowerCase().includes(query) ||
        Object.values(entry.translations).some((t) => t?.toLowerCase().includes(query))
    );
  }, [entries, searchQuery]);

  // Validate placeholders in translation
  const validatePlaceholders = useCallback((defaultText: string, translation: string): boolean => {
    const defaultPlaceholders = (defaultText.match(/\{\{(\w+)\}\}/g) || []).sort();
    const translationPlaceholders = (translation.match(/\{\{(\w+)\}\}/g) || []).sort();
    return JSON.stringify(defaultPlaceholders) === JSON.stringify(translationPlaceholders);
  }, []);

  // Check if translation is missing
  const isMissing = useCallback((entry: TranslationEntry, locale: Locale): boolean => {
    return !entry.translations[locale] || entry.translations[locale].trim() === '';
  }, []);

  // Start editing
  const startEdit = useCallback((key: string, locale: Locale) => {
    const entry = entries.find((e) => e.key === key);
    if (entry) {
      setEditingKey(key);
      setEditingLocale(locale);
      setEditValue(entry.translations[locale] || '');
    }
  }, [entries]);

  // Cancel editing
  const cancelEdit = useCallback(() => {
    setEditingKey(null);
    setEditingLocale(null);
    setEditValue('');
  }, []);

  // Save translation
  const saveTranslation = useCallback(async () => {
    if (!editingKey || !editingLocale) return;

    const entry = entries.find((e) => e.key === editingKey);
    if (!entry) return;

    // Validate placeholders
    const isValid = validatePlaceholders(entry.defaultText, editValue);
    if (!isValid) {
      alert('Placeholders do not match the default text. Please check your translation.');
      return;
    }

    setSaving(true);
    try {
      const updatedEntry: TranslationEntry = {
        ...entry,
        translations: {
          ...entry.translations,
          [editingLocale]: editValue,
        },
      };

      setEntries((prev) => prev.map((e) => (e.key === editingKey ? updatedEntry : e)));

      if (onSave) {
        await onSave(updatedEntry);
      }

      cancelEdit();
    } catch (error) {
      console.error('Failed to save translation:', error);
      alert('Failed to save translation. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [editingKey, editingLocale, editValue, entries, validatePlaceholders, onSave, cancelEdit]);

  // Export translations
  const handleExport = useCallback((format: 'json' | 'csv') => {
    if (onExport) {
      onExport(format);
      return;
    }

    if (format === 'json') {
      const data = entries.reduce((acc, entry) => {
        acc[entry.key] = entry.translations;
        return acc;
      }, {} as Record<string, Record<Locale, string>>);

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'translations.json';
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'csv') {
      const headers = ['Key', 'Default Text', ...availableLocales];
      const rows = entries.map((entry) => [
        entry.key,
        entry.defaultText,
        ...availableLocales.map((locale) => entry.translations[locale] || ''),
      ]);

      const csv = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'translations.csv';
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [entries, availableLocales, onExport]);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Header with search and actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search translations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport('json')} size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
          <Button variant="outline" onClick={() => handleExport('csv')} size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Translation table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Key</TableHead>
              <TableHead className="w-[250px]">Default Text</TableHead>
              {availableLocales.map((locale) => (
                <TableHead key={locale} className="min-w-[200px]">
                  <div className="flex items-center gap-2">
                    {locale}
                    {locale === currentLocale && (
                      <Badge variant="secondary" className="text-xs">Current</Badge>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2 + availableLocales.length} className="text-center py-8 text-muted-foreground">
                  No translations found
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries.map((entry) => (
                <TableRow key={entry.key}>
                  <TableCell className="font-mono text-sm">{entry.key}</TableCell>
                  <TableCell className="text-sm">{entry.defaultText}</TableCell>
                  {availableLocales.map((locale) => {
                    const isEditing = editingKey === entry.key && editingLocale === locale;
                    const missing = isMissing(entry, locale);
                    const isValid = !missing && validatePlaceholders(entry.defaultText, entry.translations[locale] || '');

                    return (
                      <TableCell key={locale} className="relative">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="flex-1"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  saveTranslation();
                                } else if (e.key === 'Escape') {
                                  cancelEdit();
                                }
                              }}
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={saveTranslation}
                              disabled={saving}
                              className="h-8 w-8 p-0"
                            >
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEdit}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        ) : (
                          <div
                            className={cn(
                              'group flex items-center gap-2 min-h-[32px] px-2 py-1 rounded hover:bg-muted cursor-pointer',
                              missing && 'text-muted-foreground italic'
                            )}
                            onClick={() => startEdit(entry.key, locale)}
                            title="Click to edit"
                          >
                            <span className="flex-1">
                              {missing ? '(Missing)' : entry.translations[locale]}
                            </span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {missing ? (
                                <AlertCircle className="h-4 w-4 text-yellow-600" />
                              ) : isValid ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                          </div>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {filteredEntries.length} of {entries.length} translations
        </span>
        <div className="flex items-center gap-4">
          <span>
            Missing: {entries.filter((e) => availableLocales.some((l) => isMissing(e, l))).length}
          </span>
          <span>
            Complete: {entries.filter((e) => availableLocales.every((l) => !isMissing(e, l))).length}
          </span>
        </div>
      </div>
    </div>
  );
}

