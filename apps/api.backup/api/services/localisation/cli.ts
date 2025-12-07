#!/usr/bin/env node

/**
 * B230A-INTL-003: Translation Resource Management CLI
 *
 * CLI tool for adding/updating translations, managing translation resources,
 * and validating translation files.
 */

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import {
  updateTranslation,
  deleteTranslation,
  listTranslationKeys,
  loadTranslationResource,
  saveTranslationResource,
  findMissingTranslations,
  exportTranslationResource,
  importTranslationResource,
  getAvailableLocales,
  getNamespacesForLocale,
  validateTranslationResource,
} from './translationManager';
import { Locale, isValidLocale } from './i18nConfig';

const program = new Command();

program
  .name('i18n-cli')
  .description('CLI tool for managing translation resources')
  .version('1.0.0');

// Add translation
program
  .command('add')
  .description('Add or update a translation key')
  .requiredOption('-l, --locale <locale>', 'Locale code (e.g., en-US)')
  .requiredOption('-n, --namespace <namespace>', 'Namespace (e.g., common)')
  .requiredOption('-k, --key <key>', 'Translation key (dot notation, e.g., common.save)')
  .requiredOption('-v, --value <value>', 'Translation value')
  .option('--version <version>', 'Version number', '1.0.0')
  .action((options) => {
    const { locale, namespace, key, value, version } = options;

    if (!isValidLocale(locale)) {
      console.error(`Invalid locale: ${locale}`);
      process.exit(1);
    }

    try {
      updateTranslation(locale, namespace, key, value, version);
      console.log(`✓ Added translation: ${locale}/${namespace}/${key}`);
    } catch (error) {
      console.error(`✗ Failed to add translation:`, error);
      process.exit(1);
    }
  });

// Delete translation
program
  .command('delete')
  .description('Delete a translation key')
  .requiredOption('-l, --locale <locale>', 'Locale code')
  .requiredOption('-n, --namespace <namespace>', 'Namespace')
  .requiredOption('-k, --key <key>', 'Translation key')
  .action((options) => {
    const { locale, namespace, key } = options;

    if (!isValidLocale(locale)) {
      console.error(`Invalid locale: ${locale}`);
      process.exit(1);
    }

    try {
      deleteTranslation(locale, namespace, key);
      console.log(`✓ Deleted translation: ${locale}/${namespace}/${key}`);
    } catch (error) {
      console.error(`✗ Failed to delete translation:`, error);
      process.exit(1);
    }
  });

// List keys
program
  .command('list')
  .description('List all translation keys in a namespace')
  .requiredOption('-l, --locale <locale>', 'Locale code')
  .requiredOption('-n, --namespace <namespace>', 'Namespace')
  .action((options) => {
    const { locale, namespace } = options;

    if (!isValidLocale(locale)) {
      console.error(`Invalid locale: ${locale}`);
      process.exit(1);
    }

    try {
      const keys = listTranslationKeys(locale, namespace);
      if (keys.length === 0) {
        console.log(`No keys found in ${locale}/${namespace}`);
      } else {
        console.log(`Keys in ${locale}/${namespace}:`);
        keys.forEach(key => console.log(`  - ${key}`));
      }
    } catch (error) {
      console.error(`✗ Failed to list keys:`, error);
      process.exit(1);
    }
  });

// Find missing translations
program
  .command('missing')
  .description('Find missing translations compared to reference locale')
  .requiredOption('-l, --locale <locale>', 'Locale to check')
  .option('-r, --reference <reference>', 'Reference locale', 'en-US')
  .action((options) => {
    const { locale, reference } = options;

    if (!isValidLocale(locale)) {
      console.error(`Invalid locale: ${locale}`);
      process.exit(1);
    }

    if (!isValidLocale(reference)) {
      console.error(`Invalid reference locale: ${reference}`);
      process.exit(1);
    }

    try {
      const missing = findMissingTranslations(locale, reference);
      if (missing.length === 0) {
        console.log(`✓ No missing translations in ${locale} (compared to ${reference})`);
      } else {
        console.log(`Missing translations in ${locale} (compared to ${reference}):`);
        missing.forEach(({ namespace, key }) => {
          console.log(`  - ${namespace}/${key}`);
        });
      }
    } catch (error) {
      console.error(`✗ Failed to find missing translations:`, error);
      process.exit(1);
    }
  });

// Export translations
program
  .command('export')
  .description('Export translation resource to JSON')
  .requiredOption('-l, --locale <locale>', 'Locale code')
  .requiredOption('-n, --namespace <namespace>', 'Namespace')
  .option('-o, --output <output>', 'Output file path')
  .action((options) => {
    const { locale, namespace, output } = options;

    if (!isValidLocale(locale)) {
      console.error(`Invalid locale: ${locale}`);
      process.exit(1);
    }

    try {
      const json = exportTranslationResource(locale, namespace);
      if (output) {
        fs.writeFileSync(output, json, 'utf-8');
        console.log(`✓ Exported to ${output}`);
      } else {
        console.log(json);
      }
    } catch (error) {
      console.error(`✗ Failed to export:`, error);
      process.exit(1);
    }
  });

// Import translations
program
  .command('import')
  .description('Import translation resource from JSON file')
  .requiredOption('-l, --locale <locale>', 'Locale code')
  .requiredOption('-n, --namespace <namespace>', 'Namespace')
  .requiredOption('-f, --file <file>', 'JSON file path')
  .option('--version <version>', 'Version number', '1.0.0')
  .action((options) => {
    const { locale, namespace, file, version } = options;

    if (!isValidLocale(locale)) {
      console.error(`Invalid locale: ${locale}`);
      process.exit(1);
    }

    if (!fs.existsSync(file)) {
      console.error(`File not found: ${file}`);
      process.exit(1);
    }

    try {
      const jsonContent = fs.readFileSync(file, 'utf-8');
      importTranslationResource(locale, namespace, jsonContent, version);
      console.log(`✓ Imported translations from ${file}`);
    } catch (error) {
      console.error(`✗ Failed to import:`, error);
      process.exit(1);
    }
  });

// Validate translations
program
  .command('validate')
  .description('Validate translation resource')
  .requiredOption('-l, --locale <locale>', 'Locale code')
  .requiredOption('-n, --namespace <namespace>', 'Namespace')
  .action((options) => {
    const { locale, namespace } = options;

    if (!isValidLocale(locale)) {
      console.error(`Invalid locale: ${locale}`);
      process.exit(1);
    }

    try {
      const resource = loadTranslationResource(locale, namespace);
      if (!resource) {
        console.error(`Translation resource not found: ${locale}/${namespace}`);
        process.exit(1);
      }

      const validation = validateTranslationResource(resource);
      if (validation.valid) {
        console.log(`✓ Translation resource is valid`);
      } else {
        console.error(`✗ Translation resource has errors:`);
        validation.errors.forEach(error => console.error(`  - ${error}`));
        process.exit(1);
      }
    } catch (error) {
      console.error(`✗ Failed to validate:`, error);
      process.exit(1);
    }
  });

// List locales
program
  .command('locales')
  .description('List all available locales')
  .action(() => {
    try {
      const locales = getAvailableLocales();
      if (locales.length === 0) {
        console.log('No locales found');
      } else {
        console.log('Available locales:');
        locales.forEach(locale => {
          const namespaces = getNamespacesForLocale(locale);
          console.log(`  - ${locale} (${namespaces.length} namespaces)`);
        });
      }
    } catch (error) {
      console.error(`✗ Failed to list locales:`, error);
      process.exit(1);
    }
  });

program.parse();

