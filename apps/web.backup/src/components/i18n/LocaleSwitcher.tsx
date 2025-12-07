/**
 * B252C-I18N-021: LocaleSwitcher Component
 *
 * Dropdown or button allowing users to select a language and region;
 * updates UserLocaleSetting via API; saves preference in cookie/local storage;
 * accessible with keyboard navigation
 */

'use client';

import { useState, useEffect } from 'react';
import { Globe, Check, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useTranslation, type Locale } from '@/i18n';
import { cn } from '@/lib/utils';

interface LanguageOption {
  locale: Locale;
  nativeName: string;
  englishName: string;
  flag?: string;
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { locale: 'en-US', nativeName: 'English', englishName: 'English (US)', flag: '🇺🇸' },
  { locale: 'en-GB', nativeName: 'English', englishName: 'English (UK)', flag: '🇬🇧' },
  { locale: 'es-ES', nativeName: 'Español', englishName: 'Spanish', flag: '🇪🇸' },
  { locale: 'fr-FR', nativeName: 'Français', englishName: 'French', flag: '🇫🇷' },
  { locale: 'de-DE', nativeName: 'Deutsch', englishName: 'German', flag: '🇩🇪' },
  { locale: 'ja-JP', nativeName: '日本語', englishName: 'Japanese', flag: '🇯🇵' },
  { locale: 'zh-CN', nativeName: '中文', englishName: 'Chinese', flag: '🇨🇳' },
];

interface LocaleSwitcherProps {
  variant?: 'select' | 'dropdown' | 'button';
  showNativeNames?: boolean;
  showFlags?: boolean;
  className?: string;
  onLocaleChange?: (locale: Locale) => void;
}

/**
 * Update user locale setting via API
 */
async function updateUserLocaleSetting(locale: Locale): Promise<void> {
  try {
    const response = await fetch('/api/i18n/locale', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ locale }),
    });

    if (!response.ok) {
      throw new Error('Failed to update locale setting');
    }
  } catch (error) {
    console.error('Failed to update user locale setting:', error);
    // Continue with local storage update even if API fails
  }
}

/**
 * Save locale preference to cookie and local storage
 */
function saveLocalePreference(locale: Locale): void {
  if (typeof window === 'undefined') return;

  // Save to localStorage
  localStorage.setItem('i18nextLng', locale);
  localStorage.setItem('locale', locale);

  // Save to sessionStorage
  sessionStorage.setItem('locale', locale);

  // Update document language attribute
  document.documentElement.lang = locale;

  // Save to cookie (expires in 1 year)
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `locale=${locale}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

export function LocaleSwitcher({
  variant = 'select',
  showNativeNames = true,
  showFlags = true,
  className,
  onLocaleChange,
}: LocaleSwitcherProps) {
  const { locale, changeLocale, i18n } = useTranslation();
  const [isChanging, setIsChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentLanguage = LANGUAGE_OPTIONS.find((opt) => opt.locale === locale) || LANGUAGE_OPTIONS[0];

  const handleLocaleChange = async (newLocale: Locale) => {
    if (newLocale === locale) return;

    setIsChanging(true);
    setError(null);

    try {
      // Update i18n
      await changeLocale(newLocale);

      // Save to local storage and cookie
      saveLocalePreference(newLocale);

      // Update user locale setting via API
      await updateUserLocaleSetting(newLocale);

      // Trigger callback
      onLocaleChange?.(newLocale);
    } catch (err: any) {
      console.error('Failed to change locale:', err);
      setError(err.message || 'Failed to change locale');
    } finally {
      setIsChanging(false);
    }
  };

  const renderLanguageLabel = (option: LanguageOption) => {
    const parts: string[] = [];
    if (showFlags && option.flag) {
      parts.push(option.flag);
    }
    parts.push(showNativeNames ? option.nativeName : option.englishName);
    return parts.join(' ');
  };

  if (variant === 'select') {
    return (
      <div className={cn('relative', className)}>
        <Select
          value={locale}
          onValueChange={handleLocaleChange}
          disabled={isChanging}
        >
          <SelectTrigger
            className={cn('w-[180px]', className)}
            aria-label="Select language"
            aria-describedby={error ? 'locale-error' : undefined}
          >
            <div className="flex items-center gap-2">
              {isChanging ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Globe className="h-4 w-4" aria-hidden="true" />
              )}
              <SelectValue>
                {renderLanguageLabel(currentLanguage)}
              </SelectValue>
            </div>
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_OPTIONS.map((option) => (
              <SelectItem
                key={option.locale}
                value={option.locale}
                aria-label={`Select ${option.englishName}`}
              >
                <div className="flex items-center gap-2">
                  {showFlags && option.flag && (
                    <span aria-hidden="true">{option.flag}</span>
                  )}
                  <span>{showNativeNames ? option.nativeName : option.englishName}</span>
                  {option.locale === locale && (
                    <Check className="h-4 w-4 ml-auto" aria-hidden="true" />
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && (
          <p id="locale-error" className="text-sm text-destructive mt-1" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (variant === 'dropdown') {
    return (
      <div className={cn('relative', className)}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={cn('gap-2', className)}
              disabled={isChanging}
              aria-label="Select language"
              aria-describedby={error ? 'locale-error' : undefined}
            >
              {isChanging ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Globe className="h-4 w-4" aria-hidden="true" />
              )}
              {renderLanguageLabel(currentLanguage)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            {LANGUAGE_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.locale}
                onClick={() => handleLocaleChange(option.locale)}
                className={cn(
                  'flex items-center gap-2 cursor-pointer',
                  option.locale === locale && 'bg-accent'
                )}
                aria-label={`Select ${option.englishName}`}
              >
                {showFlags && option.flag && (
                  <span className="text-lg" aria-hidden="true">{option.flag}</span>
                )}
                <span className="flex-1">
                  {showNativeNames ? option.nativeName : option.englishName}
                </span>
                {option.locale === locale && (
                  <Check className="h-4 w-4" aria-hidden="true" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {error && (
          <p id="locale-error" className="text-sm text-destructive mt-1" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  // Button variant - shows as a simple button with icon
  return (
    <div className={cn('relative', className)}>
      <Button
        variant="outline"
        size="sm"
        className={cn('gap-2', className)}
        disabled={isChanging}
        onClick={() => {
          // Cycle through languages
          const currentIndex = LANGUAGE_OPTIONS.findIndex((opt) => opt.locale === locale);
          const nextIndex = (currentIndex + 1) % LANGUAGE_OPTIONS.length;
          handleLocaleChange(LANGUAGE_OPTIONS[nextIndex].locale);
        }}
        aria-label={`Current language: ${currentLanguage.englishName}. Click to change language.`}
        aria-describedby={error ? 'locale-error' : undefined}
      >
        {isChanging ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Globe className="h-4 w-4" aria-hidden="true" />
        )}
        {showNativeNames ? currentLanguage.nativeName : currentLanguage.englishName}
      </Button>
      {error && (
        <p id="locale-error" className="text-sm text-destructive mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

