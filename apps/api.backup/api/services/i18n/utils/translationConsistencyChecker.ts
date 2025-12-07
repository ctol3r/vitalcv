/**
 * B241B-I18N-012: TranslationConsistencyChecker
 *
 * Validates translations for consistency:
 * - Placeholder counts match
 * - No extra markup
 * - Flags missing variables
 * - Reports issues per locale
 * - Outputs a summary report
 */

export interface TranslationKey {
  key: string;
  locale: string;
  value: string;
}

export interface ConsistencyIssue {
  key: string;
  locale: string;
  severity: 'error' | 'warning';
  type: 'placeholder_mismatch' | 'missing_variable' | 'extra_markup' | 'missing_translation';
  message: string;
  details?: Record<string, any>;
}

export interface ConsistencyReport {
  totalKeys: number;
  totalLocales: number;
  issues: ConsistencyIssue[];
  summary: {
    errors: number;
    warnings: number;
    issuesByLocale: Record<string, number>;
    issuesByType: Record<string, number>;
  };
}

/**
 * Translation consistency checker
 * Validates that translations are consistent across locales
 */
export class TranslationConsistencyChecker {
  /**
   * Check consistency of translations
   */
  checkConsistency(translations: Record<string, Record<string, string>>): ConsistencyReport {
    const issues: ConsistencyIssue[] = [];
    const locales = Object.keys(translations);
    const allKeys = new Set<string>();

    // Collect all keys
    for (const locale of locales) {
      Object.keys(translations[locale] || {}).forEach((key) => allKeys.add(key));
    }

    // Check each key across all locales
    for (const key of allKeys) {
      const baseLocale = locales[0];
      const baseValue = translations[baseLocale]?.[key];

      if (!baseValue) {
        // Check if key is missing in base locale
        for (const locale of locales) {
          if (translations[locale]?.[key]) {
            issues.push({
              key,
              locale,
              severity: 'error',
              type: 'missing_translation',
              message: `Key exists in ${locale} but missing in base locale ${baseLocale}`,
            });
          }
        }
        continue;
      }

      // Extract placeholders from base value
      const basePlaceholders = this.extractPlaceholders(baseValue);
      const baseMarkup = this.extractMarkup(baseValue);

      // Check each locale
      for (const locale of locales) {
        const value = translations[locale]?.[key];

        if (!value) {
          issues.push({
            key,
            locale,
            severity: 'error',
            type: 'missing_translation',
            message: `Translation missing for key "${key}" in locale "${locale}"`,
          });
          continue;
        }

        // Check placeholder consistency
        const placeholders = this.extractPlaceholders(value);
        const placeholderIssues = this.checkPlaceholders(
          key,
          locale,
          basePlaceholders,
          placeholders
        );
        issues.push(...placeholderIssues);

        // Check markup consistency
        const markup = this.extractMarkup(value);
        const markupIssues = this.checkMarkup(key, locale, baseMarkup, markup);
        issues.push(...markupIssues);
      }
    }

    // Generate summary
    const summary = this.generateSummary(issues, locales);

    return {
      totalKeys: allKeys.size,
      totalLocales: locales.length,
      issues,
      summary,
    };
  }

  /**
   * Extract placeholders from a translation string
   * Supports {variable}, {{variable}}, and {variable, format} patterns
   */
  private extractPlaceholders(text: string): Set<string> {
    const placeholders = new Set<string>();
    // Match {variable}, {{variable}}, and {variable, format}
    const regex = /\{+([^}]+)\}+/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const placeholder = match[1].split(',')[0].trim(); // Remove format specifiers
      placeholders.add(placeholder);
    }

    return placeholders;
  }

  /**
   * Extract HTML/XML markup tags from a translation string
   */
  private extractMarkup(text: string): Set<string> {
    const markup = new Set<string>();
    // Match HTML/XML tags
    const regex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      markup.add(match[1].toLowerCase());
    }

    return markup;
  }

  /**
   * Check placeholder consistency between base and target translations
   */
  private checkPlaceholders(
    key: string,
    locale: string,
    basePlaceholders: Set<string>,
    targetPlaceholders: Set<string>
  ): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

    // Check for missing placeholders
    for (const placeholder of basePlaceholders) {
      if (!targetPlaceholders.has(placeholder)) {
        issues.push({
          key,
          locale,
          severity: 'error',
          type: 'missing_variable',
          message: `Placeholder "{${placeholder}}" is missing in locale "${locale}"`,
          details: {
            expectedPlaceholders: Array.from(basePlaceholders),
            actualPlaceholders: Array.from(targetPlaceholders),
          },
        });
      }
    }

    // Check for extra placeholders (warning)
    for (const placeholder of targetPlaceholders) {
      if (!basePlaceholders.has(placeholder)) {
        issues.push({
          key,
          locale,
          severity: 'warning',
          type: 'placeholder_mismatch',
          message: `Extra placeholder "{${placeholder}}" found in locale "${locale}"`,
          details: {
            expectedPlaceholders: Array.from(basePlaceholders),
            actualPlaceholders: Array.from(targetPlaceholders),
          },
        });
      }
    }

    return issues;
  }

  /**
   * Check markup consistency between base and target translations
   */
  private checkMarkup(
    key: string,
    locale: string,
    baseMarkup: Set<string>,
    targetMarkup: Set<string>
  ): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

    // Check for extra markup (warning)
    for (const tag of targetMarkup) {
      if (!baseMarkup.has(tag)) {
        issues.push({
          key,
          locale,
          severity: 'warning',
          type: 'extra_markup',
          message: `Extra markup tag "<${tag}>" found in locale "${locale}"`,
          details: {
            expectedMarkup: Array.from(baseMarkup),
            actualMarkup: Array.from(targetMarkup),
          },
        });
      }
    }

    return issues;
  }

  /**
   * Generate summary report
   */
  private generateSummary(
    issues: ConsistencyIssue[],
    locales: string[]
  ): ConsistencyReport['summary'] {
    const errors = issues.filter((i) => i.severity === 'error').length;
    const warnings = issues.filter((i) => i.severity === 'warning').length;

    const issuesByLocale: Record<string, number> = {};
    const issuesByType: Record<string, number> = {};

    for (const locale of locales) {
      issuesByLocale[locale] = 0;
    }

    for (const issue of issues) {
      issuesByLocale[issue.locale] = (issuesByLocale[issue.locale] || 0) + 1;
      issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
    }

    return {
      errors,
      warnings,
      issuesByLocale,
      issuesByType,
    };
  }

  /**
   * Format report as a human-readable string
   */
  formatReport(report: ConsistencyReport): string {
    const lines: string[] = [];
    lines.push('Translation Consistency Report');
    lines.push('='.repeat(50));
    lines.push(`Total Keys: ${report.totalKeys}`);
    lines.push(`Total Locales: ${report.totalLocales}`);
    lines.push(`Total Issues: ${report.issues.length} (${report.summary.errors} errors, ${report.summary.warnings} warnings)`);
    lines.push('');

    // Summary by locale
    lines.push('Issues by Locale:');
    for (const [locale, count] of Object.entries(report.summary.issuesByLocale)) {
      lines.push(`  ${locale}: ${count}`);
    }
    lines.push('');

    // Summary by type
    lines.push('Issues by Type:');
    for (const [type, count] of Object.entries(report.summary.issuesByType)) {
      lines.push(`  ${type}: ${count}`);
    }
    lines.push('');

    // Detailed issues
    if (report.issues.length > 0) {
      lines.push('Detailed Issues:');
      for (const issue of report.issues) {
        lines.push(`  [${issue.severity.toUpperCase()}] ${issue.locale}:${issue.key}`);
        lines.push(`    ${issue.message}`);
      }
    }

    return lines.join('\n');
  }
}

