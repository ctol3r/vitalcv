'use client';

import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import { localeOptions } from '@/lib/i18n-locales';

export function LocaleSwitcher() {
  const { i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null; // Avoid hydration mismatch

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  };

  const selected = useMemo(() => {
    const current = i18n.language;
    const direct = localeOptions.find((option) => option.code === current);
    if (direct) return direct.code;
    const fallback = localeOptions.find((option) => current.startsWith(option.code));
    return fallback?.code ?? localeOptions[0].code;
  }, [i18n.language]);

  return (
    <div className="relative inline-block text-left">
      <select
        value={selected}
        onChange={handleChange}
        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
        aria-label="Select Language"
      >
        {localeOptions.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label} — {option.nativeLabel}
          </option>
        ))}
      </select>
    </div>
  );
}





