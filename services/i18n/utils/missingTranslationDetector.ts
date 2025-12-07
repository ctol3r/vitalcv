/**
 * B241B-I18N-013: MissingTranslationDetector
 *
 * Scans code and translation files to detect missing or unused keys:
 * - Outputs list of keys per locale that require translation
 * - Integrates with CI pipeline
 */

import * as fs from 'fs';
import * as path from 'path';

export interface TranslationKey {
  key: string;
  file?: string;
  line?: number;
}

export interface MissingTranslationReport {
  missingKeys: Record<string, string[]>; // locale -> keys[]
  unusedKeys: Record<string, string[]>; // locale -> keys[]
  totalMissing: number;
  totalUnused: number;
}

export interface ScanOptions {
  codePaths: string[];
  translationPaths: string[];
  baseLocale?: string;
  fileExtensions?: string[];
  excludePatterns?: string[];
}

/**
 * Missing translation detector
 * Scans codebase and translation files to find missing or unused translations
 */
export class MissingTranslationDetector {
  private options: Required<ScanOptions>;

  constructor(options: ScanOptions) {
    this.options = {
      baseLocale: 'en-US',
      fileExtensions: ['.ts', '.tsx', '.js', '.jsx'],
      excludePatterns: ['node_modules', 'dist', 'build', '.git'],
      ...options,
    };
  }

  /**
   * Scan code and translation files to detect missing translations
   */
  async detectMissingTranslations(): Promise<MissingTranslationReport> {
    // Extract translation keys from code
    const codeKeys = await this.extractKeysFromCode();

    // Load translation files
    const translations = await this.loadTranslationFiles();

    // Find missing keys per locale
    const missingKeys: Record<string, string[]> = {};
    const locales = Object.keys(translations);

    for (const locale of locales) {
      missingKeys[locale] = [];
      for (const key of codeKeys) {
        if (!this.hasTranslation(translations[locale], key)) {
          missingKeys[locale].push(key);
        }
      }
    }

    // Find unused keys (keys in translation files but not in code)
    const unusedKeys: Record<string, string[]> = {};
    const allCodeKeys = new Set(codeKeys);

    for (const locale of locales) {
      unusedKeys[locale] = [];
      const translationKeys = this.getAllKeys(translations[locale]);
      for (const key of translationKeys) {
        if (!allCodeKeys.has(key)) {
          unusedKeys[locale].push(key);
        }
      }
    }

    const totalMissing = Object.values(missingKeys).reduce((sum, keys) => sum + keys.length, 0);
    const totalUnused = Object.values(unusedKeys).reduce((sum, keys) => sum + keys.length, 0);

    return {
      missingKeys,
      unusedKeys,
      totalMissing,
      totalUnused,
    };
  }

  /**
   * Extract translation keys from code files
   * Looks for patterns like t('key'), t("key"), i18n.t('key'), etc.
   */
  private async extractKeysFromCode(): Promise<string[]> {
    const keys = new Set<string>();
    const files = await this.findCodeFiles();

    for (const file of files) {
      const content = await fs.promises.readFile(file, 'utf-8');
      const fileKeys = this.extractKeysFromContent(content);
      fileKeys.forEach((key) => keys.add(key));
    }

    return Array.from(keys);
  }

  /**
   * Find all code files to scan
   */
  private async findCodeFiles(): Promise<string[]> {
    const files: string[] = [];

    for (const codePath of this.options.codePaths) {
      await this.findFilesRecursive(codePath, files);
    }

    return files;
  }

  /**
   * Recursively find files matching the criteria
   */
  private async findFilesRecursive(dir: string, files: string[]): Promise<void> {
    if (!fs.existsSync(dir)) {
      return;
    }

    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip excluded patterns
      if (this.options.excludePatterns.some((pattern) => fullPath.includes(pattern))) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.findFilesRecursive(fullPath, files);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (this.options.fileExtensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  /**
   * Extract translation keys from file content
   * Supports patterns like:
   * - t('key')
   * - t("key")
   * - t('key.subkey')
   * - i18n.t('key')
   * - $t('key')
   */
  private extractKeysFromContent(content: string): string[] {
    const keys: string[] = [];

    // Match t('key'), t("key"), i18n.t('key'), $t('key'), etc.
    const patterns = [
      /(?:^|[^a-zA-Z0-9_])t\s*\(\s*['"]([^'"]+)['"]/g,
      /(?:^|[^a-zA-Z0-9_])i18n\.t\s*\(\s*['"]([^'"]+)['"]/g,
      /(?:^|[^a-zA-Z0-9_])\$t\s*\(\s*['"]([^'"]+)['"]/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        keys.push(match[1]);
      }
    }

    return keys;
  }

  /**
   * Load translation files from the specified paths
   */
  private async loadTranslationFiles(): Promise<Record<string, Record<string, string>>> {
    const translations: Record<string, Record<string, string>> = {};

    for (const translationPath of this.options.translationPaths) {
      if (!fs.existsSync(translationPath)) {
        continue;
      }

      const entries = await fs.promises.readdir(translationPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.json')) {
          const locale = path.basename(entry.name, '.json');
          const filePath = path.join(translationPath, entry.name);
          const content = await fs.promises.readFile(filePath, 'utf-8');

          try {
            translations[locale] = JSON.parse(content);
          } catch (error) {
            console.warn(`Failed to parse translation file ${filePath}: ${error}`);
          }
        }
      }
    }

    return translations;
  }

  /**
   * Check if a translation exists for a key
   */
  private hasTranslation(translations: Record<string, any>, key: string): boolean {
    const parts = key.split('.');
    let current: any = translations;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return false;
      }
    }

    return typeof current === 'string';
  }

  /**
   * Get all keys from a translation object (nested)
   */
  private getAllKeys(translations: Record<string, any>, prefix: string = ''): string[] {
    const keys: string[] = [];

    for (const [key, value] of Object.entries(translations)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'string') {
        keys.push(fullKey);
      } else if (typeof value === 'object' && value !== null) {
        keys.push(...this.getAllKeys(value, fullKey));
      }
    }

    return keys;
  }

  /**
   * Format report as a human-readable string
   */
  formatReport(report: MissingTranslationReport): string {
    const lines: string[] = [];
    lines.push('Missing Translation Report');
    lines.push('='.repeat(50));
    lines.push(`Total Missing Keys: ${report.totalMissing}`);
    lines.push(`Total Unused Keys: ${report.totalUnused}`);
    lines.push('');

    // Missing keys by locale
    if (report.totalMissing > 0) {
      lines.push('Missing Keys by Locale:');
      for (const [locale, keys] of Object.entries(report.missingKeys)) {
        if (keys.length > 0) {
          lines.push(`  ${locale}: ${keys.length} missing`);
          for (const key of keys.slice(0, 10)) {
            lines.push(`    - ${key}`);
          }
          if (keys.length > 10) {
            lines.push(`    ... and ${keys.length - 10} more`);
          }
        }
      }
      lines.push('');
    }

    // Unused keys by locale
    if (report.totalUnused > 0) {
      lines.push('Unused Keys by Locale:');
      for (const [locale, keys] of Object.entries(report.unusedKeys)) {
        if (keys.length > 0) {
          lines.push(`  ${locale}: ${keys.length} unused`);
          for (const key of keys.slice(0, 10)) {
            lines.push(`    - ${key}`);
          }
          if (keys.length > 10) {
            lines.push(`    ... and ${keys.length - 10} more`);
          }
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Export report as JSON for CI integration
   */
  exportReport(report: MissingTranslationReport): string {
    return JSON.stringify(report, null, 2);
  }
}

