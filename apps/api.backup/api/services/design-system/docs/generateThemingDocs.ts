/**
 * B246B-DES-018: ThemingDocumentationGenerator
 *
 * Script that generates documentation pages from theme definitions.
 * Lists tokens, color samples, typography examples.
 * Outputs markdown or mdx for docs site.
 */

import * as fs from 'fs';
import * as path from 'path';
import { lightTheme, darkTheme } from '../theme/themes';
import { exampleThemes } from '../theme/customTheme';
import type { Theme } from '../theme/themeTypes';

/**
 * Generate color swatch HTML/Markdown
 */
function generateColorSwatch(colorName: string, colorValue: string): string {
  return `
<div style="display: inline-block; margin: 8px;">
  <div style="width: 100px; height: 100px; background-color: ${colorValue}; border: 1px solid #e5e7eb; border-radius: 4px;"></div>
  <div style="margin-top: 4px; font-size: 12px; text-align: center;">
    <strong>${colorName}</strong><br/>
    <code>${colorValue}</code>
  </div>
</div>`;
}

/**
 * Generate theme documentation
 */
function generateThemeDocs(theme: Theme, outputFormat: 'markdown' | 'mdx' = 'markdown'): string {
  const lines: string[] = [];

  lines.push(`# ${theme.name.charAt(0).toUpperCase() + theme.name.slice(1)} Theme`);
  lines.push('');
  lines.push(`This document describes the ${theme.name} theme tokens and values.`);
  lines.push('');

  // Colors section
  lines.push('## Colors');
  lines.push('');
  lines.push('### Color Tokens');
  lines.push('');
  lines.push('| Token | Value | Preview |');
  lines.push('|-------|-------|---------|');

  Object.entries(theme.colors).forEach(([key, value]) => {
    lines.push(`| \`${key}\` | \`${value}\` | <span style="display: inline-block; width: 20px; height: 20px; background-color: ${value}; border: 1px solid #ccc; border-radius: 2px;"></span> |`);
  });

  lines.push('');
  lines.push('### Color Swatches');
  lines.push('');
  lines.push('<div style="display: flex; flex-wrap: wrap;">');
  Object.entries(theme.colors).forEach(([key, value]) => {
    lines.push(generateColorSwatch(key, value));
  });
  lines.push('</div>');
  lines.push('');

  // Typography section
  lines.push('## Typography');
  lines.push('');
  lines.push('### Font Family');
  lines.push('');
  lines.push('| Token | Value |');
  lines.push('|-------|-------|');
  Object.entries(theme.typography.fontFamily).forEach(([key, value]) => {
    lines.push(`| \`${key}\` | \`${value}\` |`);
  });
  lines.push('');

  lines.push('### Font Sizes');
  lines.push('');
  lines.push('| Token | Value | Example |');
  lines.push('|-------|-------|---------|');
  Object.entries(theme.typography.fontSize).forEach(([key, value]) => {
    const exampleSize = key === 'xs' ? '0.75rem' : key === 'sm' ? '0.875rem' : value;
    lines.push(`| \`${key}\` | \`${value}\` | <span style="font-size: ${value};">Sample text</span> |`);
  });
  lines.push('');

  lines.push('### Font Weights');
  lines.push('');
  lines.push('| Token | Value |');
  lines.push('|-------|-------|');
  Object.entries(theme.typography.fontWeight).forEach(([key, value]) => {
    lines.push(`| \`${key}\` | \`${value}\` |`);
  });
  lines.push('');

  // Spacing section
  lines.push('## Spacing');
  lines.push('');
  lines.push('| Token | Value |');
  lines.push('|-------|-------|');
  Object.entries(theme.spacing).forEach(([key, value]) => {
    lines.push(`| \`${key}\` | \`${value}\` |`);
  });
  lines.push('');

  // Border Radius section
  lines.push('## Border Radius');
  lines.push('');
  lines.push('| Token | Value |');
  lines.push('|-------|-------|');
  Object.entries(theme.borderRadius).forEach(([key, value]) => {
    lines.push(`| \`${key}\` | \`${value}\` |`);
  });
  lines.push('');

  // Shadows section
  lines.push('## Shadows');
  lines.push('');
  lines.push('| Token | Value |');
  lines.push('|-------|-------|');
  Object.entries(theme.shadows).forEach(([key, value]) => {
    lines.push(`| \`${key}\` | \`${value}\` |`);
  });
  lines.push('');

  // Breakpoints section
  if (theme.breakpoints) {
    lines.push('## Breakpoints');
    lines.push('');
    lines.push('| Token | Value |');
    lines.push('|-------|-------|');
    Object.entries(theme.breakpoints).forEach(([key, value]) => {
      lines.push(`| \`${key}\` | \`${value}\` |`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate index documentation
 */
function generateIndexDocs(): string {
  const lines: string[] = [];

  lines.push('# Design System Themes');
  lines.push('');
  lines.push('This documentation is auto-generated from theme definitions.');
  lines.push('');
  lines.push('## Available Themes');
  lines.push('');
  lines.push('- [Light Theme](./themes/light.md)');
  lines.push('- [Dark Theme](./themes/dark.md)');
  lines.push('');
  lines.push('## Custom Themes');
  lines.push('');
  lines.push('- [Ocean Theme](./themes/ocean.md)');
  lines.push('- [Violet Theme](./themes/violet.md)');
  lines.push('- [Forest Theme](./themes/forest.md)');
  lines.push('');
  lines.push('## Usage');
  lines.push('');
  lines.push('```typescript');
  lines.push("import { ThemeProvider, useTheme } from '@chai-vc/design-system';");
  lines.push('');
  lines.push('function App() {');
  lines.push('  return (');
  lines.push('    <ThemeProvider>');
  lines.push('      <YourApp />');
  lines.push('    </ThemeProvider>');
  lines.push('  );');
  lines.push('}');
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

/**
 * Main generation function
 */
export function generateThemingDocs(outputDir: string = './docs/themes'): void {
  // Create output directory
  const themesDir = path.join(outputDir, 'themes');
  if (!fs.existsSync(themesDir)) {
    fs.mkdirSync(themesDir, { recursive: true });
  }

  // Generate theme docs
  fs.writeFileSync(
    path.join(themesDir, 'light.md'),
    generateThemeDocs(lightTheme)
  );

  fs.writeFileSync(
    path.join(themesDir, 'dark.md'),
    generateThemeDocs(darkTheme)
  );

  // Generate custom theme docs
  Object.entries(exampleThemes).forEach(([name, theme]) => {
    fs.writeFileSync(
      path.join(themesDir, `${name}.md`),
      generateThemeDocs(theme)
    );
  });

  // Generate index
  fs.writeFileSync(
    path.join(outputDir, 'README.md'),
    generateIndexDocs()
  );

  console.log(`✅ Generated theme documentation in ${outputDir}`);
  console.log(`   - Light theme: ${path.join(themesDir, 'light.md')}`);
  console.log(`   - Dark theme: ${path.join(themesDir, 'dark.md')}`);
  console.log(`   - Custom themes: ${Object.keys(exampleThemes).join(', ')}`);
}

/**
 * CLI usage
 */
if (require.main === module) {
  const outputDir = process.argv[2] || './docs/themes';
  generateThemingDocs(outputDir);
}

