/**
 * Internationalization (i18n) Scaffolding
 *
 * Basic i18n support with en-US as seed locale
 * Can be extended to support multiple languages
 */

export type Locale = 'en-US' | 'es-ES' | 'fr-FR' | 'de-DE';

export interface Translation {
  [key: string]: string | Translation;
}

const translations: Record<Locale, Translation> = {
  'en-US': {
    common: {
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      cancel: 'Cancel',
      continue: 'Continue',
      back: 'Back',
      next: 'Next',
      finish: 'Finish',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      close: 'Close',
      confirm: 'Confirm',
    },
    wizard: {
      title: 'Claim NPI Verification',
      subtitle: 'Complete all steps to verify your identity and claim this NPI',
      step1: {
        title: 'Confirm Email',
        description: 'Verify your email address to begin',
        emailLabel: 'Email Address',
        emailPlaceholder: 'your.email@example.com',
        phoneLabel: 'Phone Number',
        phonePlaceholder: '+1 (555) 000-0000',
        sendCode: 'Send Verification Code',
        codeLabel: 'Enter 6-digit code',
        codePlaceholder: '000000',
        verifyCode: 'Verify Code',
        resend: 'Resend Code',
        resendAvailable: 'Resend available in {seconds}s',
        codeNotReceived: 'Code not received?',
        switchToSms: 'Switch to SMS',
        switchToEmail: 'Switch to Email',
        sendVia: 'Send code via',
        domainHint: 'Did you mean @{domain}?',
      },
      step2: {
        title: 'Verify Identity',
        description: 'Upload identity documents and selfie',
        documentsLabel: 'Identity Documents',
        documentsPlaceholder: 'Upload Documents',
        documentsDescription: 'PDF, JPG, or PNG',
        selfieLabel: 'Selfie Verification',
        takePhoto: 'Take Photo',
        uploadPhoto: 'Upload Photo',
        capture: 'Capture',
        submitDocuments: 'Submit Documents',
        uploading: 'Uploading...',
        processing: 'Processing...',
        identityVerified: 'Identity verified!',
        confidence: 'Confidence: {score}%',
      },
      step3: {
        title: 'Issuer Attestation',
        description: 'Request attestation from a trusted issuer',
        whatIsAttestation: 'What is Issuer Attestation?',
        attestationDescription:
          'An authorized healthcare organization will review your credentials and provide on-chain verification, giving you Level 3 claim status.',
        requestAttestation: 'Request Issuer Attestation',
        requesting: 'Requesting...',
        notificationMessage: 'You will be notified when your attestation request is reviewed',
      },
      errors: {
        invalidEmail: 'Please enter a valid email address',
        invalidPhone: 'Please enter a valid phone number',
        invalidCode: 'Please enter a 6-digit code',
        codeVerificationFailed: 'Verification failed. Please check your code and try again.',
        uploadFailed: 'Upload failed',
        documentQuality: 'Document quality issue',
        documentQualityDescription:
          'Please ensure your documents are clear and well-lit. Try taking a new photo with better lighting.',
        faceVerification: 'Face verification issue',
        faceVerificationDescription:
          'Please ensure your face is clearly visible and matches your document photo.',
        networkError: 'Please check your connection and try again.',
      },
      success: {
        emailVerified: '✓ Email verified! Proceeding to Level 1 verification.',
        identityVerified: "🎉 Identity verified! You've reached Level 2.",
        attestationRequested: '🏆 Attestation requested!',
        attestationDescription: 'An authorized issuer will review your credentials.',
        addToWallet: 'Add to Wallet',
      },
    },
    npi: {
      title: 'National Provider Identifier',
      enterNpi: 'Enter your 10-digit NPI to begin',
      npiPlaceholder: '1234567890',
      invalidNpi: 'NPI must be exactly 10 digits',
      formatted: 'Formatted: {npi}',
      continueToProfile: 'Continue to NPI Profile',
      whatHappensNext: 'What happens next?',
      publicLookup: 'View public NPPES information',
      claimOwnership: 'Claim ownership through verification (L1-L3)',
      receiveCredentials: 'Receive verifiable credentials',
      publicLookupNote:
        'Note: Public NPI lookup ≠ identity verification. Claiming verifies your identity in steps (L0–L3).',
    },
    wallet: {
      title: 'Credential Wallet',
      noCredentials: 'No credentials yet',
      noCredentialsDescription: 'Complete the claim wizard to receive your first credential',
      searchPlaceholder: 'Search credentials...',
      filterByStatus: 'Filter by status',
      statusActive: 'Active',
      statusRevoked: 'Revoked',
      statusExpired: 'Expired',
      exportPdf: 'Export as PDF',
      viewDetails: 'View Details',
      shareCredential: 'Share Credential',
      verifiedOnChain: 'Verified on-chain',
    },
    verifier: {
      title: 'Verify Credential',
      scanQr: 'Scan QR Code',
      pasteLink: 'Or paste credential link',
      linkPlaceholder: 'Enter credential URL or ID',
      verify: 'Verify Presentation',
      verifying: 'Verifying...',
      statusValid: 'Valid',
      statusRevoked: 'Revoked',
      statusExpired: 'Expired',
      statusUnknown: 'Unknown',
      recheck: 'Re-check Status',
      downloadReport: 'Download Verification Report',
      contactIssuer: 'Contact Issuer',
    },
    issuer: {
      title: 'Issuer Portal',
      issueCredential: 'Issue Credential',
      bulkIssuance: 'Bulk Issuance',
      templates: 'Templates',
      templateLicense: 'Medical License',
      templateBoardCert: 'Board Certification',
      templateResidency: 'Residency Completion',
      revokeCredential: 'Revoke Credential',
      revocationReason: 'Reason for revocation',
      attestationInbox: 'Attestation Inbox',
      approve: 'Approve',
      deny: 'Deny',
    },
  },
  'es-ES': {
    common: {
      loading: 'Cargando...',
      error: 'Error',
      success: 'Éxito',
      cancel: 'Cancelar',
      continue: 'Continuar',
      back: 'Atrás',
      next: 'Siguiente',
      finish: 'Finalizar',
    },
    // Add more translations as needed
  },
  'fr-FR': {
    common: {
      loading: 'Chargement...',
      error: 'Erreur',
      success: 'Succès',
      cancel: 'Annuler',
      continue: 'Continuer',
      back: 'Retour',
      next: 'Suivant',
      finish: 'Terminer',
    },
    // Add more translations as needed
  },
  'de-DE': {
    common: {
      loading: 'Wird geladen...',
      error: 'Fehler',
      success: 'Erfolg',
      cancel: 'Abbrechen',
      continue: 'Weiter',
      back: 'Zurück',
      next: 'Weiter',
      finish: 'Fertig',
    },
    // Add more translations as needed
  },
};

let currentLocale: Locale = 'en-US';

/**
 * Get current locale
 */
export function getLocale(): Locale {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('locale');
    if (stored && isValidLocale(stored)) {
      return stored as Locale;
    }

    // Try to detect from browser
    const browserLocale = navigator.language;
    if (isValidLocale(browserLocale)) {
      return browserLocale as Locale;
    }
  }

  return currentLocale;
}

/**
 * Set current locale
 */
export function setLocale(locale: Locale): void {
  if (!isValidLocale(locale)) {
    console.warn(`Invalid locale: ${locale}, falling back to en-US`);
    locale = 'en-US';
  }

  currentLocale = locale;

  if (typeof window !== 'undefined') {
    localStorage.setItem('locale', locale);
    document.documentElement.lang = locale;
  }
}

/**
 * Check if locale is valid
 */
function isValidLocale(locale: string): boolean {
  return locale in translations;
}

/**
 * Get translation by key path
 */
export function t(keyPath: string, params?: Record<string, string | number>): string {
  const locale = getLocale();
  const keys = keyPath.split('.');

  let value: any = translations[locale];

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      // Fall back to en-US
      let fallback: any = translations['en-US'];
      for (const k of keys) {
        fallback = fallback?.[k];
      }
      value = fallback || keyPath;
      break;
    }
  }

  if (typeof value !== 'string') {
    return keyPath;
  }

  // Replace parameters
  if (params) {
    return value.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key]?.toString() || match;
    });
  }

  return value;
}

/**
 * Get all available locales
 */
export function getAvailableLocales(): Locale[] {
  return Object.keys(translations) as Locale[];
}

/**
 * Get locale display name
 */
export function getLocaleDisplayName(locale: Locale): string {
  const displayNames: Record<Locale, string> = {
    'en-US': 'English (US)',
    'es-ES': 'Español',
    'fr-FR': 'Français',
    'de-DE': 'Deutsch',
  };

  return displayNames[locale] || locale;
}
