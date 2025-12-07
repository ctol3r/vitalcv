import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';
import { localeOptions } from '../src/lib/i18n-locales';

export const languages = localeOptions.map((option) => option.code) as Array<
  (typeof localeOptions)[number]['code']
>;
export const namespaces = ['common'] as const;
export const defaultNS = namespaces[0];

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: languages,
    ns: namespaces,
    defaultNS,
    debug: process.env.NODE_ENV === 'development',
    interpolation: {
      escapeValue: false,
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    detection: {
      order: ['cookie', 'localStorage', 'navigator'],
      caches: ['cookie', 'localStorage'],
      lookupCookie: 'vitalcv_locale',
      lookupLocalStorage: 'i18nextLng',
    },
    react: {
      useSuspense: true,
    },
  });

export default i18n;





