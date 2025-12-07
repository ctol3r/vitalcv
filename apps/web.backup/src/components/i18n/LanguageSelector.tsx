/**
 * B241C-I18N-022: LanguageSelector UI
 *
 * Dropdown or menu to select preferred language:
 * - Updates session/local storage
 * - Triggers LocaleSwitchService
 * - Displays language names in native form
 * - Accessible and responsive
 */

'use client';

import { useState, useEffect } from 'react';
import { Globe, Check } from 'lucide-react';
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
  { locale: 'en-US', nativeName: 'English', englishName: 'English', flag: '🇺🇸' },
  { locale: 'en-GB', nativeName: 'English', englishName: 'English (UK)', flag: '🇬🇧' },
  { locale: 'es-ES', nativeName: 'Español', englishName: 'Spanish', flag: '🇪🇸' },
  { locale: 'fr-FR', nativeName: 'Français', englishName: 'French', flag: '🇫🇷' },
  { locale: 'de-DE', nativeName: 'Deutsch', englishName: 'German', flag: '🇩🇪' },
  { locale: 'ja-JP', nativeName: '日本語', englishName: 'Japanese', flag: '🇯🇵' },
  { locale: 'zh-CN', nativeName: '中文', englishName: 'Chinese', flag: '🇨🇳' },
];

interface LanguageSelectorProps {
  variant?: 'select' | 'dropdown' | 'button';
  showNativeNames?: boolean;
  showFlags?: boolean;
  className?: string;
  onLocaleChange?: (locale: Locale) => void;
}

/**
 * Service to handle locale switching
 * Updates localStorage and triggers any necessary side effects
 */
async function switchLocale(locale: Locale): Promise<void> {
  // Update localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('i18nextLng', locale);
    localStorage.setItem('locale', locale);

    // Update document language attribute
    document.documentElement.lang = locale;

    // Update session storage if needed
    sessionStorage.setItem('locale', locale);
  }

  // In a real implementation, this would call a backend service
  // For now, we'll use the i18n changeLanguage method
  // This could be extended to call an API endpoint
  try {
    // If there's a backend service, call it here
    // await fetch('/api/locale/switch', { method: 'POST', body: JSON.stringify({ locale }) });
  } catch (error) {
    console.error('Failed to switch locale on server:', error);
  }
}

export function LanguageSelector({
  variant = 'select',
  showNativeNames = true,
  showFlags = true,
  className,
  onLocaleChange,
}: LanguageSelectorProps) {
  const { locale, changeLocale, i18n } = useTranslation();
  const [isChanging, setIsChanging] = useState(false);

  const currentLanguage = LANGUAGE_OPTIONS.find((opt) => opt.locale === locale) || LANGUAGE_OPTIONS[0];

  const handleLocaleChange = async (newLocale: Locale) => {
    if (newLocale === locale) return;

    setIsChanging(true);
    try {
      // Update i18n
      await changeLocale(newLocale);

      // Call locale switch service
      await switchLocale(newLocale);

      // Trigger callback
      onLocaleChange?.(newLocale);
    } catch (error) {
      console.error('Failed to change locale:', error);
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
      <Select
        value={locale}
        onValueChange={handleLocaleChange}
        disabled={isChanging}
      >
        <SelectTrigger className={cn('w-[180px]', className)}>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <SelectValue>
              {renderLanguageLabel(currentLanguage)}
            </SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent>
          {LANGUAGE_OPTIONS.map((option) => (
            <SelectItem key={option.locale} value={option.locale}>
              <div className="flex items-center gap-2">
                {showFlags && option.flag && <span>{option.flag}</span>}
                <span>{showNativeNames ? option.nativeName : option.englishName}</span>
                {option.locale === locale && <Check className="h-4 w-4 ml-auto" />}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (variant === 'dropdown') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn('gap-2', className)}
            disabled={isChanging}
          >
            <Globe className="h-4 w-4" />
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
            >
              {showFlags && option.flag && <span className="text-lg">{option.flag}</span>}
              <span className="flex-1">{showNativeNames ? option.nativeName : option.englishName}</span>
              {option.locale === locale && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Button variant - shows as a simple button with icon
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn('gap-2', className)}
      disabled={isChanging}
      onClick={() => {
        // Cycle through languages or open a menu
        const currentIndex = LANGUAGE_OPTIONS.findIndex((opt) => opt.locale === locale);
        const nextIndex = (currentIndex + 1) % LANGUAGE_OPTIONS.length;
        handleLocaleChange(LANGUAGE_OPTIONS[nextIndex].locale);
      }}
    >
      <Globe className="h-4 w-4" />
      {showNativeNames ? currentLanguage.nativeName : currentLanguage.englishName}
    </Button>
  );
}

