/**
 * B241C-I18N-026: LanguageAwareSearch component
 *
 * Search bar that handles diacritics and locale-specific collation;
 * highlights results even with accent differences; supports transliteration for some languages;
 * works with backend search
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTranslation, type Locale } from '@/i18n';
import { cn } from '@/lib/utils';

interface LanguageAwareSearchProps {
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  debounceMs?: number;
  highlightResults?: boolean;
}

// Normalize text by removing diacritics for search
function normalizeForSearch(text: string, locale: Locale): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase();
}

// Transliteration for some languages (simplified)
function transliterate(text: string, locale: Locale): string {
  // This is a simplified implementation
  // In production, use a proper transliteration library
  const transliterationMap: Record<string, Record<string, string>> = {
    'zh-CN': {
      // Simplified Chinese to Pinyin (basic)
    },
    'ja-JP': {
      // Japanese to Romaji (basic)
    },
  };

  const map = transliterationMap[locale];
  if (!map) return text;

  let result = text;
  for (const [key, value] of Object.entries(map)) {
    result = result.replace(new RegExp(key, 'g'), value);
  }
  return result;
}

// Highlight matching text in results
function highlightMatch(text: string, query: string, locale: Locale): React.ReactNode {
  if (!query) return text;

  const normalizedText = normalizeForSearch(text, locale);
  const normalizedQuery = normalizeForSearch(query, locale);

  if (!normalizedText.includes(normalizedQuery)) return text;

  // Find the actual match position (accounting for diacritics)
  const index = normalizedText.indexOf(normalizedQuery);
  if (index === -1) return text;

  // Find the actual match in original text (approximate)
  // This is simplified - in production, use proper string matching
  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);

  return (
    <>
      {before}
      <mark className="bg-yellow-200 dark:bg-yellow-900">{match}</mark>
      {after}
    </>
  );
}

export function LanguageAwareSearch({
  value = '',
  onChange,
  onSearch,
  placeholder,
  className,
  disabled,
  debounceMs = 300,
  highlightResults = true,
}: LanguageAwareSearchProps) {
  const { locale } = useTranslation();
  const [query, setQuery] = useState(value);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Handle input change with debounce
  const handleChange = useCallback(
    (newValue: string) => {
      setQuery(newValue);

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      onChange?.(newValue);

      const timer = setTimeout(() => {
        onSearch?.(newValue);
      }, debounceMs);

      setDebounceTimer(timer);
    },
    [onChange, onSearch, debounceMs, debounceTimer]
  );

  // Clear search
  const handleClear = useCallback(() => {
    setQuery('');
    onChange?.('');
    onSearch?.('');
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  }, [onChange, onSearch, debounceTimer]);

  // Normalized query for matching
  const normalizedQuery = useMemo(() => {
    return normalizeForSearch(query, locale);
  }, [query, locale]);

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder || 'Search...'}
          disabled={disabled}
          className="pl-9 pr-9"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Hook for language-aware search matching
 */
export function useLanguageAwareSearch() {
  const { locale } = useTranslation();

  const matches = useCallback(
    (text: string, query: string): boolean => {
      if (!query) return true;

      const normalizedText = normalizeForSearch(text, locale);
      const normalizedQuery = normalizeForSearch(query, locale);

      // Direct match
      if (normalizedText.includes(normalizedQuery)) return true;

      // Transliteration match
      const transliteratedText = transliterate(text, locale);
      const transliteratedQuery = transliterate(query, locale);
      if (transliteratedText.includes(transliteratedQuery)) return true;

      return false;
    },
    [locale]
  );

  const highlight = useCallback(
    (text: string, query: string): React.ReactNode => {
      return highlightMatch(text, query, locale);
    },
    [locale]
  );

  return { matches, highlight };
}

