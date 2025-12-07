'use client';

import { useEffect } from 'react';
import { initI18n } from '../i18n';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize i18n on client-side
    initI18n();
  }, []);

  return <>{children}</>;
}

