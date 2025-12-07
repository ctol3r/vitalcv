'use client';

import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { languages } from '../../i18n/config';

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

  return (
    <div className="relative inline-block text-left">
      <select
        value={i18n.language}
        onChange={handleChange}
        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
        aria-label="Select Language"
      >
        {languages.map((lang) => (
          <option key={lang} value={lang}>
            {lang}
          </option>
        ))}
      </select>
    </div>
  );
}














