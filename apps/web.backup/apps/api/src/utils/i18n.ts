export const supportedLanguages = ['en', 'es', 'fr', 'de', 'zh-Hans', 'ar', 'he'] as const;

const translations: Record<string, Record<string, string>> = {
  en: {
    'email.subject.welcome': 'Welcome to VitalCV',
    'email.subject.verify': 'Verify your email',
    'notification.credential_issued': 'A new credential has been issued to you',
    'alert.readiness_jump': 'Readiness jumped above the hiring bar',
    'alert.critical_clear': 'All critical dimensions cleared',
  },
  es: {
    'email.subject.welcome': 'Bienvenido a VitalCV',
    'email.subject.verify': 'Verifica tu correo electrónico',
    'notification.credential_issued': 'Se te ha emitido una nueva credencial',
    'alert.readiness_jump': 'La preparación superó el umbral de contratación',
    'alert.critical_clear': 'Todos los parámetros críticos están en verde',
  },
  fr: {
    'email.subject.welcome': 'Bienvenue sur VitalCV',
    'email.subject.verify': 'Vérifiez votre courriel',
    'notification.credential_issued': 'Un nouveau justificatif vient de vous être délivré',
    'alert.readiness_jump': 'Le score de préparation a dépassé le seuil',
    'alert.critical_clear': 'Tous les indicateurs critiques sont au vert',
  },
  de: {
    'email.subject.welcome': 'Willkommen bei VitalCV',
    'email.subject.verify': 'Bestätige deine E-Mail-Adresse',
    'notification.credential_issued': 'Ein neuer Berechtigungsnachweis wurde erstellt',
    'alert.readiness_jump': 'Der Readiness-Score liegt nun über dem Grenzwert',
    'alert.critical_clear': 'Alle kritischen Dimensionen sind erfüllt',
  },
  'zh-Hans': {
    'email.subject.welcome': '欢迎使用 VitalCV',
    'email.subject.verify': '请验证您的邮箱',
    'notification.credential_issued': '已为您签发新的凭证',
    'alert.readiness_jump': '准备度已超过招聘阈值',
    'alert.critical_clear': '所有关键维度均达标',
  },
  ar: {
    'email.subject.welcome': 'مرحبًا بك في VitalCV',
    'email.subject.verify': 'قم بتأكيد بريدك الإلكتروني',
    'notification.credential_issued': 'تم إصدار اعتماد جديد لك',
    'alert.readiness_jump': 'مستوى الجاهزية تجاوز حد التوظيف',
    'alert.critical_clear': 'تم اجتياز جميع الأبعاد الحرجة',
  },
  he: {
    'email.subject.welcome': 'ברוך הבא ל-VitalCV',
    'email.subject.verify': 'אמת את כתובת הדוא״ל שלך',
    'notification.credential_issued': 'הונפק עבורך אישור חדש',
    'alert.readiness_jump': 'ציון המוכנות עבר את רף הגיוס',
    'alert.critical_clear': 'כל הממדים הקריטיים נבדקו ואושרו',
  },
};

export function translate(key: string, lang: string = 'en'): string {
  const normalized = normalizeLanguage(lang);
  const localeData = translations[normalized] || translations.en;
  return localeData[key] || translations.en[key] || key;
}

function normalizeLanguage(lang: string): string {
  if (translations[lang]) {
    return lang;
  }
  const base = lang.split('-')[0];
  const match = supportedLanguages.find((candidate) => candidate.startsWith(base));
  return match ?? 'en';
}





