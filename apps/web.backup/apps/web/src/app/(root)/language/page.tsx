import { cookies } from 'next/headers';
import LanguageSelector from './selector';

export default function LanguageSettingsPage() {
  const locale = cookies().get('vitalcv_locale')?.value ?? 'en';
  return <LanguageSelector initialLocale={locale} />;
}










