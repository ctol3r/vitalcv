const fs = require('node:fs');
const path = require('node:path');

const CONTRAST_RULES = [
  {
    source: 'apps/web/design-system/themes/light.ts',
    parser: 'ts-theme',
    themes: ['light'],
    pairs: [
      { text: 'textPrimary', backgrounds: ['background', 'surface', 'surfaceSubtle'], min: 4.5 },
      { text: 'textSecondary', backgrounds: ['background', 'surface', 'surfaceSubtle'], min: 4.5 },
      { text: 'textMuted', backgrounds: ['background', 'surface', 'surfaceSubtle'], min: 3 },
    ],
  },
  {
    source: 'apps/web/design-system/themes/dark.ts',
    parser: 'ts-theme',
    themes: ['dark'],
    pairs: [
      { text: 'textPrimary', backgrounds: ['background', 'surface', 'surfaceSubtle'], min: 4.5 },
      { text: 'textSecondary', backgrounds: ['background', 'surface', 'surfaceSubtle'], min: 4.5 },
      { text: 'textMuted', backgrounds: ['background', 'surface', 'surfaceSubtle'], min: 3 },
    ],
  },
  {
    source: 'apps/web/styles/themes/index.css',
    parser: 'css-vars',
    themes: ['light', 'dark'],
    pairs: [
      { text: '--vt-text-primary', backgrounds: ['--vt-bg', '--vt-surface', '--vt-surface-subtle', '--vt-surface-dim'], min: 4.5 },
      { text: '--vt-text-secondary', backgrounds: ['--vt-bg', '--vt-surface', '--vt-surface-subtle', '--vt-surface-dim'], min: 4.5 },
      { text: '--vt-text-muted', backgrounds: ['--vt-bg', '--vt-surface', '--vt-surface-subtle', '--vt-surface-dim'], min: 3 },
      { text: '--vt-badge-critical-text', backgrounds: ['--vt-badge-critical-bg'], min: 4.5 },
      { text: '--vt-badge-warning-text', backgrounds: ['--vt-badge-warning-bg'], min: 4.5 },
      { text: '--vt-badge-success-text', backgrounds: ['--vt-badge-success-bg'], min: 4.5 },
      { text: '--vt-badge-info-text', backgrounds: ['--vt-badge-info-bg'], min: 4.5 },
      { text: '--vt-badge-neutral-text', backgrounds: ['--vt-badge-neutral-bg'], min: 4.5 },
    ],
  },
  {
    source: 'apps/web/styles/foundation.css',
    parser: 'css-vars',
    themes: ['light'],
    pairs: [
      { text: '--vt-text-primary', backgrounds: ['--vt-bg', '--vt-surface', '--vt-surface-subtle', '--vt-surface-dim'], min: 4.5 },
      { text: '--vt-text-secondary', backgrounds: ['--vt-bg', '--vt-surface', '--vt-surface-subtle', '--vt-surface-dim'], min: 4.5 },
      { text: '--vt-text-muted', backgrounds: ['--vt-bg', '--vt-surface', '--vt-surface-subtle', '--vt-surface-dim'], min: 3 },
      { text: '--ops-text', backgrounds: ['--ops-bg', '--ops-surface', '--ops-surface-alt'], min: 4.5 },
      { text: '--ops-text-muted', backgrounds: ['--ops-bg', '--ops-surface', '--ops-surface-alt'], min: 3 },
      { text: '--trust-l0-fg', backgrounds: ['--trust-l0-bg'], min: 3 },
      { text: '--trust-l1-fg', backgrounds: ['--trust-l1-bg'], min: 3 },
      { text: '--trust-l2-fg', backgrounds: ['--trust-l2-bg'], min: 3 },
      { text: '--trust-l3-fg', backgrounds: ['--trust-l3-bg'], min: 3 },
      { text: '--vt-badge-checked-text', backgrounds: ['--vt-badge-checked-bg'], min: 4.5 },
      { text: '--vt-badge-pending-text', backgrounds: ['--vt-badge-pending-bg'], min: 4.5 },
      { text: '--vt-badge-access-text', backgrounds: ['--vt-badge-access-bg'], min: 4.5 },
      { text: '--vt-badge-unavailable-text', backgrounds: ['--vt-badge-unavailable-bg'], min: 4.5 },
      { text: '--vt-badge-preview-text', backgrounds: ['--vt-badge-preview-bg'], min: 4.5 },
    ],
  },
  {
    source: 'apps/marketing/app/globals.css',
    parser: 'css-vars',
    themes: ['light', 'dark'],
    pairs: [
      { text: '--foreground', backgrounds: ['--background', '--surface'], min: 4.5 },
      { text: '--muted', backgrounds: ['--background', '--surface'], min: 4.5 },
      { text: '--accent-foreground', backgrounds: ['--accent'], min: 4.5 },
    ],
  },
];

function toRelative(root, filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function cleanCssValue(value) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
}

function parseCssVariableThemes(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const blockRegex = /([^{}]+)\{([^{}]+)\}/g;
  const themes = {
    light: {},
    dark: {},
  };

  for (const match of source.matchAll(blockRegex)) {
    const selector = match[1].trim();
    const body = match[2];
    if (!body.includes('--')) {
      continue;
    }

    const targetTheme = selector.includes('.dark') || selector.includes("[data-theme='dark']")
      ? 'dark'
      : selector.includes(':root') || selector.includes('html.light') || selector.includes("[data-theme='light']")
        ? 'light'
        : null;

    if (!targetTheme) {
      continue;
    }

    const declarations = body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g);
    for (const declaration of declarations) {
      themes[targetTheme][declaration[1]] = cleanCssValue(declaration[2]);
    }
  }

  return themes;
}

function parseTsThemeColors(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const match = source.match(/colors:\s*\{([\s\S]*?)\n\s*\},\n?\s*\};/m);
  const colors = {};

  if (!match) {
    return colors;
  }

  for (const declaration of match[1].matchAll(/(\w+)\s*:\s*'([^']+)'/g)) {
    colors[declaration[1]] = declaration[2].trim();
  }

  return colors;
}

function resolveVar(value, tokenMap, seen = new Set()) {
  const trimmed = cleanCssValue(value);
  const varMatch = trimmed.match(/^var\((--[\w-]+)\)$/);

  if (!varMatch) {
    return trimmed;
  }

  const token = varMatch[1];
  if (seen.has(token) || !tokenMap[token]) {
    return null;
  }

  seen.add(token);
  return resolveVar(tokenMap[token], tokenMap, seen);
}

function parseAlpha(raw) {
  if (!raw) {
    return 1;
  }

  const trimmed = raw.trim();
  if (trimmed.endsWith('%')) {
    return clamp01(Number.parseFloat(trimmed) / 100);
  }
  return clamp01(Number.parseFloat(trimmed));
}

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function parseHexColor(value) {
  const hex = value.slice(1);
  if (![3, 4, 6, 8].includes(hex.length)) {
    return null;
  }

  const expanded = hex.length <= 4
    ? hex.split('').map((char) => char + char).join('')
    : hex;
  const rgb = expanded.slice(0, 6);
  const alpha = expanded.length === 8 ? expanded.slice(6, 8) : 'ff';

  return {
    r: Number.parseInt(rgb.slice(0, 2), 16) / 255,
    g: Number.parseInt(rgb.slice(2, 4), 16) / 255,
    b: Number.parseInt(rgb.slice(4, 6), 16) / 255,
    a: Number.parseInt(alpha, 16) / 255,
  };
}

function parseRgbColor(value) {
  const normalized = value
    .replace(/^rgba?\(/i, '')
    .replace(/\)$/g, '')
    .trim();
  const [channelsPart, alphaPart] = normalized.split('/');
  const channels = channelsPart
    .replace(/,/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((channel) => Number.parseFloat(channel));

  if (channels.length < 3 || channels.some((channel) => !Number.isFinite(channel))) {
    return null;
  }

  return {
    r: clamp01(channels[0] / 255),
    g: clamp01(channels[1] / 255),
    b: clamp01(channels[2] / 255),
    a: parseAlpha(alphaPart),
  };
}

function oklchToSrgb(l, c, h) {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);

  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = l - 0.0894841775 * a - 1.291485548 * b;

  const lCube = lPrime ** 3;
  const mCube = mPrime ** 3;
  const sCube = sPrime ** 3;

  return {
    r: gammaCorrect(4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube),
    g: gammaCorrect(-1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube),
    b: gammaCorrect(-0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube),
  };
}

function gammaCorrect(channel) {
  const clamped = clamp01(channel);
  if (clamped <= 0.0031308) {
    return 12.92 * clamped;
  }
  return 1.055 * (clamped ** (1 / 2.4)) - 0.055;
}

function parseOklchColor(value) {
  const match = value.match(/^oklch\(\s*([0-9.]+%?)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+%?))?\s*\)$/i);
  if (!match) {
    return null;
  }

  const l = match[1].endsWith('%')
    ? Number.parseFloat(match[1]) / 100
    : Number.parseFloat(match[1]);
  const c = Number.parseFloat(match[2]);
  const h = Number.parseFloat(match[3]);

  if (![l, c, h].every(Number.isFinite)) {
    return null;
  }

  const srgb = oklchToSrgb(l, c, h);
  return {
    ...srgb,
    a: parseAlpha(match[4]),
  };
}

function parseColor(value, tokenMap = {}) {
  if (!value) {
    return null;
  }

  const resolved = value.startsWith('var(') ? resolveVar(value, tokenMap) : cleanCssValue(value);
  if (!resolved) {
    return null;
  }

  if (resolved.startsWith('#')) {
    return parseHexColor(resolved);
  }
  if (/^rgba?\(/i.test(resolved)) {
    return parseRgbColor(resolved);
  }
  if (/^oklch\(/i.test(resolved)) {
    return parseOklchColor(resolved);
  }
  return null;
}

function composite(foreground, background) {
  const alpha = foreground.a;
  const inverse = 1 - alpha;

  return {
    r: foreground.r * alpha + background.r * inverse,
    g: foreground.g * alpha + background.g * inverse,
    b: foreground.b * alpha + background.b * inverse,
    a: 1,
  };
}

function relativeLuminance(color) {
  const convert = (channel) => (
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );

  return 0.2126 * convert(color.r) + 0.7152 * convert(color.g) + 0.0722 * convert(color.b);
}

function contrastRatio(foreground, background) {
  const fg = foreground.a < 1 ? composite(foreground, background) : foreground;
  const bg = background.a < 1 ? composite(background, { r: 1, g: 1, b: 1, a: 1 }) : background;
  const lighter = Math.max(relativeLuminance(fg), relativeLuminance(bg));
  const darker = Math.min(relativeLuminance(fg), relativeLuminance(bg));
  return (lighter + 0.05) / (darker + 0.05);
}

function formatRatio(value) {
  return value.toFixed(2);
}

function collectThemeViolations(root, rule) {
  const filePath = path.join(root, rule.source);
  const parsed = rule.parser === 'ts-theme'
    ? { [rule.themes[0]]: parseTsThemeColors(filePath) }
    : parseCssVariableThemes(filePath);
  const violations = [];

  for (const themeName of rule.themes) {
    const tokens = parsed[themeName];
    if (!tokens || Object.keys(tokens).length === 0) {
      continue;
    }

    for (const pair of rule.pairs) {
      const textValue = tokens[pair.text];
      const textColor = parseColor(textValue, tokens);
      if (!textColor) {
        violations.push({
          file: toRelative(root, filePath),
          theme: themeName,
          text: pair.text,
          background: '(unresolved)',
          min: pair.min,
          ratio: null,
          detail: `Missing or unreadable text token ${pair.text}.`,
        });
        continue;
      }

      for (const backgroundToken of pair.backgrounds) {
        const backgroundValue = tokens[backgroundToken];
        const backgroundColor = parseColor(backgroundValue, tokens);
        if (!backgroundColor) {
          violations.push({
            file: toRelative(root, filePath),
            theme: themeName,
            text: pair.text,
            background: backgroundToken,
            min: pair.min,
            ratio: null,
            detail: `Missing or unreadable background token ${backgroundToken}.`,
          });
          continue;
        }

        const ratio = contrastRatio(textColor, backgroundColor);
        if (ratio < pair.min) {
          violations.push({
            file: toRelative(root, filePath),
            theme: themeName,
            text: pair.text,
            background: backgroundToken,
            min: pair.min,
            ratio,
            detail: `${pair.text} on ${backgroundToken} is ${formatRatio(ratio)}:1; requires ${pair.min}:1.`,
          });
        }
      }
    }
  }

  return violations;
}

function collectContrastViolations(root) {
  return CONTRAST_RULES.flatMap((rule) => collectThemeViolations(root, rule));
}

function assertContrast(root) {
  const violations = collectContrastViolations(root);
  if (violations.length === 0) {
    return [];
  }

  const error = new Error('Contrast violation');
  error.violations = violations;
  throw error;
}

module.exports = {
  assertContrast,
  collectContrastViolations,
};
