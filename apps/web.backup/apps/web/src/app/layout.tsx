import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { RTLProvider } from '@/contexts/RTLContext';
import { rtlLocales } from '@/lib/i18n-locales';
import { RoleUXProvider } from '@/contexts/RoleUXContext';
import { RoleUXShell } from '@/components/ux/RoleUXShell';

export default function RootLayout({ children }: { children: ReactNode }) {
  const locale = cookies().get('vitalcv_locale')?.value ?? 'en';
  const isRTL = rtlLocales.includes(locale as (typeof rtlLocales)[number]);

  return (
    <html lang={locale} dir={isRTL ? 'rtl' : 'ltr'}>
      <body
        className={`min-h-screen bg-white text-neutral-900 antialiased ${
          isRTL ? 'rtl font-sans' : ''
        }`}
      >
        <RTLProvider locale={locale}>
          <RoleUXProvider>
            <RoleUXShell>{children}</RoleUXShell>
          </RoleUXProvider>
        </RTLProvider>
      </body>
    </html>
  );
}

