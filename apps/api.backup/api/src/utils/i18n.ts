export const supportedLanguages = ['en-US', 'en-GB', 'fr-CA', 'hi-IN', 'es-MX', 'de-DE'];

const translations: Record<string, Record<string, string>> = {
  'en-US': {
    'email.subject.welcome': 'Welcome to VitalCV',
    'email.subject.verify': 'Verify your email',
    'notification.credential_issued': 'A new credential has been issued to you',
  },
  'en-GB': {
    'email.subject.welcome': 'Welcome to VitalCV',
    'email.subject.verify': 'Verify your email',
    'notification.credential_issued': 'A new credential has been issued to you',
  },
  'fr-CA': {
    'email.subject.welcome': 'Bienvenue à VitalCV',
    'email.subject.verify': 'Vérifiez votre courriel',
    'notification.credential_issued': 'Un nouveau justificatif vous a été délivré',
  },
  'hi-IN': {
    'email.subject.welcome': 'VitalCV में आपका स्वागत है',
    'email.subject.verify': 'अपना ईमेल सत्यापित करें',
    'notification.credential_issued': 'आपको एक नया क्रेडेंशियल जारी किया गया है',
  },
  'es-MX': {
    'email.subject.welcome': 'Bienvenido a VitalCV',
    'email.subject.verify': 'Verifica tu correo electrónico',
    'notification.credential_issued': 'Se te ha emitido una nueva credencial',
  },
  'de-DE': {
    'email.subject.welcome': 'Willkommen bei VitalCV',
    'email.subject.verify': 'Überprüfen Sie Ihre E-Mail',
    'notification.credential_issued': 'Ein neuer Berechtigungsnachweis wurde Ihnen ausgestellt',
  },
};

export function translate(key: string, lang: string = 'en-US'): string {
  // Handle generic language codes (e.g. 'en' -> 'en-US')
  let targetLang = lang;
  if (!translations[targetLang]) {
     const found = supportedLanguages.find(l => l.startsWith(lang.split('-')[0]));
     if (found) targetLang = found;
  }

  const localeData = translations[targetLang] || translations['en-US'];
  return localeData[key] || translations['en-US'][key] || key;
}














