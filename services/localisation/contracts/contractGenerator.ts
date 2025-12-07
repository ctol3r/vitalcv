/**
 * B230B-INTL-009: LocalizationAwareContractGenerator
 *
 * Generates user agreements, business contracts, and credentials forms
 * in the appropriate language and with region-specific clauses.
 * Uses translation resources.
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '@chai-vc/logging-core';
import { RegionalPolicyConfigService } from '../models/RegionalPolicyConfig';

const logger = createLogger({ service: 'localisation-contract-generator' });

export type ContractType =
  | 'USER_AGREEMENT'
  | 'PRIVACY_POLICY'
  | 'TERMS_OF_SERVICE'
  | 'BUSINESS_CONTRACT'
  | 'CREDENTIAL_FORM'
  | 'CONSENT_FORM';

export type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'zh' | 'ja';

export interface ContractTemplate {
  type: ContractType;
  language: LanguageCode;
  title: string;
  content: string;
  clauses: ContractClause[];
  metadata?: Record<string, unknown>;
}

export interface ContractClause {
  id: string;
  type: 'STANDARD' | 'REGIONAL' | 'ORG_SPECIFIC';
  content: string;
  required: boolean;
  jurisdiction?: string;
}

export interface ContractGenerationOptions {
  contractType: ContractType;
  language: LanguageCode;
  countryCode: string;
  regionCode?: string;
  orgId?: string;
  userId?: string;
  customClauses?: ContractClause[];
  variables?: Record<string, string>;
}

/**
 * LocalizationAwareContractGenerator
 *
 * Generates contracts with proper localization and region-specific clauses
 */
export class LocalizationAwareContractGenerator {
  private policyService: RegionalPolicyConfigService;

  // Translation resources (in production, would be loaded from i18n files or database)
  private translations: Record<
    LanguageCode,
    Record<string, Record<string, string>>
  > = {
    en: {
      USER_AGREEMENT: {
        title: 'User Agreement',
        intro: 'By using this service, you agree to the following terms:',
      },
      PRIVACY_POLICY: {
        title: 'Privacy Policy',
        intro: 'This privacy policy describes how we handle your data:',
      },
      CONSENT_FORM: {
        title: 'Consent Form',
        intro: 'Please review and consent to the following:',
      },
    },
    es: {
      USER_AGREEMENT: {
        title: 'Acuerdo de Usuario',
        intro: 'Al usar este servicio, acepta los siguientes términos:',
      },
      PRIVACY_POLICY: {
        title: 'Política de Privacidad',
        intro: 'Esta política de privacidad describe cómo manejamos sus datos:',
      },
      CONSENT_FORM: {
        title: 'Formulario de Consentimiento',
        intro: 'Por favor revise y consienta lo siguiente:',
      },
    },
    fr: {
      USER_AGREEMENT: {
        title: "Accord d'Utilisateur",
        intro: "En utilisant ce service, vous acceptez les conditions suivantes:",
      },
      PRIVACY_POLICY: {
        title: 'Politique de Confidentialité',
        intro: 'Cette politique de confidentialité décrit comment nous traitons vos données:',
      },
      CONSENT_FORM: {
        title: "Formulaire de Consentement",
        intro: 'Veuillez examiner et consentir à ce qui suit:',
      },
    },
    de: {},
    it: {},
    pt: {},
    zh: {},
    ja: {},
  };

  // Regional clauses by jurisdiction
  private regionalClauses: Record<
    string,
    Record<ContractType, ContractClause[]>
  > = {
    EU: {
      USER_AGREEMENT: [
        {
          id: 'gdpr-rights',
          type: 'REGIONAL',
          content:
            'You have the right to access, rectify, erase, restrict processing, object to processing, and data portability under GDPR.',
          required: true,
          jurisdiction: 'EU',
        },
      ],
      PRIVACY_POLICY: [
        {
          id: 'gdpr-legal-basis',
          type: 'REGIONAL',
          content:
            'We process your data based on legal basis as required by GDPR Article 6.',
          required: true,
          jurisdiction: 'EU',
        },
      ],
      CONSENT_FORM: [
        {
          id: 'gdpr-explicit-consent',
          type: 'REGIONAL',
          content:
            'You provide explicit consent for data processing as required by GDPR.',
          required: true,
          jurisdiction: 'EU',
        },
      ],
      CREDENTIAL_FORM: [],
      BUSINESS_CONTRACT: [],
      TERMS_OF_SERVICE: [],
    },
    'US-CA': {
      USER_AGREEMENT: [
        {
          id: 'ccpa-rights',
          type: 'REGIONAL',
          content:
            'You have the right to know, delete, and opt-out of sale of personal information under CCPA.',
          required: true,
          jurisdiction: 'US-CA',
        },
      ],
      PRIVACY_POLICY: [
        {
          id: 'ccpa-disclosure',
          type: 'REGIONAL',
          content:
            'We disclose the categories of personal information we collect and use as required by CCPA.',
          required: true,
          jurisdiction: 'US-CA',
        },
      ],
      CONSENT_FORM: [],
      CREDENTIAL_FORM: [],
      BUSINESS_CONTRACT: [],
      TERMS_OF_SERVICE: [],
    },
  };

  constructor(private prisma: PrismaClient) {
    this.policyService = new RegionalPolicyConfigService(prisma);
  }

  /**
   * Generate a contract with localization and region-specific clauses
   */
  async generateContract(
    options: ContractGenerationOptions
  ): Promise<ContractTemplate> {
    logger.info('Generating contract', {
      type: options.contractType,
      language: options.language,
      countryCode: options.countryCode,
      regionCode: options.regionCode,
    });

    // Get regional policy for region-specific clauses
    const policy = await this.policyService.getPolicy(
      options.countryCode,
      options.regionCode,
      options.orgId
    );

    // Get base template
    const baseTemplate = this.getBaseTemplate(
      options.contractType,
      options.language
    );

    // Get regional clauses
    const jurisdictionKey = this.getJurisdictionKey(
      options.countryCode,
      options.regionCode
    );
    const regionalClauses =
      this.regionalClauses[jurisdictionKey]?.[options.contractType] || [];

    // Get policy-specific clauses
    const policyClauses = this.getPolicyClauses(
      policy,
      options.contractType,
      options.language
    );

    // Combine all clauses
    const allClauses = [
      ...baseTemplate.clauses,
      ...regionalClauses,
      ...policyClauses,
      ...(options.customClauses || []),
    ];

    // Apply variable substitution
    let content = baseTemplate.content;
    if (options.variables) {
      for (const [key, value] of Object.entries(options.variables)) {
        content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }
    }

    // Add clauses to content
    const clausesContent = allClauses
      .map((clause) => `\n\n${clause.content}`)
      .join('');

    return {
      type: options.contractType,
      language: options.language,
      title: baseTemplate.title,
      content: content + clausesContent,
      clauses: allClauses,
      metadata: {
        countryCode: options.countryCode,
        regionCode: options.regionCode,
        orgId: options.orgId,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Get base template for a contract type and language
   */
  private getBaseTemplate(
    type: ContractType,
    language: LanguageCode
  ): ContractTemplate {
    const translations = this.translations[language]?.[type] || this.translations.en[type] || {};

    return {
      type,
      language,
      title: translations.title || `${type} (${language})`,
      content: translations.intro || `This is a ${type} template.`,
      clauses: [],
    };
  }

  /**
   * Get jurisdiction key for regional clauses lookup
   */
  private getJurisdictionKey(
    countryCode: string,
    regionCode?: string
  ): string {
    if (countryCode === 'US' && regionCode === 'CA') {
      return 'US-CA';
    }
    if (['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'].includes(countryCode)) {
      return 'EU';
    }
    return countryCode;
  }

  /**
   * Get policy-specific clauses
   */
  private getPolicyClauses(
    policy: any,
    contractType: ContractType,
    language: LanguageCode
  ): ContractClause[] {
    if (!policy) {
      return [];
    }

    const clauses: ContractClause[] = [];

    // Add data retention clause if applicable
    if (
      contractType === 'PRIVACY_POLICY' &&
      policy.dataRetentionDays
    ) {
      clauses.push({
        id: 'data-retention',
        type: 'REGIONAL',
        content: `Data will be retained for ${policy.dataRetentionDays} days as per regional policy.`,
        required: true,
      });
    }

    // Add consent requirements clause
    if (
      contractType === 'CONSENT_FORM' &&
      policy.requiresExplicitConsent
    ) {
      clauses.push({
        id: 'explicit-consent',
        type: 'REGIONAL',
        content:
          'Explicit consent is required for data processing in this jurisdiction.',
        required: true,
      });
    }

    // Add cookie consent clause
    if (
      contractType === 'CONSENT_FORM' &&
      policy.requiresCookieConsent
    ) {
      clauses.push({
        id: 'cookie-consent',
        type: 'REGIONAL',
        content:
          'Cookie consent is required for this service in this jurisdiction.',
        required: true,
      });
    }

    return clauses;
  }

  /**
   * Generate contract in multiple languages
   */
  async generateMultilingualContract(
    options: Omit<ContractGenerationOptions, 'language'>,
    languages: LanguageCode[]
  ): Promise<Record<LanguageCode, ContractTemplate>> {
    const contracts: Record<string, ContractTemplate> = {};

    for (const lang of languages) {
      contracts[lang] = await this.generateContract({
        ...options,
        language: lang,
      });
    }

    return contracts as Record<LanguageCode, ContractTemplate>;
  }

  /**
   * Get available languages for a contract type
   */
  getAvailableLanguages(contractType: ContractType): LanguageCode[] {
    return Object.keys(this.translations) as LanguageCode[];
  }
}

