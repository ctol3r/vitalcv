/**
 * B242B-ACC-017: Inclusive Icon Set
 *
 * Curated set of icons with clear shapes and labels.
 * Includes versions for dark/light backgrounds, line/solid styles.
 * Provides alt text.
 * Integrates with UI library.
 */

export interface IconVariant {
  /** Variant identifier */
  id: string;
  /** SVG path data */
  path: string;
  /** View box dimensions */
  viewBox: string;
  /** Whether this is a line or solid style */
  style: 'line' | 'solid';
  /** Recommended for light or dark backgrounds */
  background: 'light' | 'dark' | 'both';
}

export interface IconDefinition {
  /** Icon name/identifier */
  name: string;
  /** Icon description for accessibility */
  description: string;
  /** Default alt text */
  altText: string;
  /** Variants of the icon */
  variants: IconVariant[];
  /** Category */
  category: string;
  /** Tags for searchability */
  tags: string[];
}

/**
 * Inclusive icon set
 */
export const INCLUSIVE_ICONS: Record<string, IconDefinition> = {
  user: {
    name: 'user',
    description: 'Generic user icon representing a person',
    altText: 'User',
    category: 'people',
    tags: ['person', 'user', 'account', 'profile'],
    variants: [
      {
        id: 'user-line',
        path: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
        viewBox: '0 0 24 24',
        style: 'line',
        background: 'both',
      },
      {
        id: 'user-solid',
        path: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
        viewBox: '0 0 24 24',
        style: 'solid',
        background: 'both',
      },
    ],
  },
  settings: {
    name: 'settings',
    description: 'Settings or configuration icon',
    altText: 'Settings',
    category: 'system',
    tags: ['settings', 'config', 'preferences', 'gear'],
    variants: [
      {
        id: 'settings-line',
        path: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
        viewBox: '0 0 24 24',
        style: 'line',
        background: 'both',
      },
    ],
  },
  check: {
    name: 'check',
    description: 'Checkmark or success icon',
    altText: 'Success',
    category: 'status',
    tags: ['check', 'success', 'done', 'complete', 'approved'],
    variants: [
      {
        id: 'check-line',
        path: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
        viewBox: '0 0 24 24',
        style: 'line',
        background: 'both',
      },
      {
        id: 'check-solid',
        path: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
        viewBox: '0 0 24 24',
        style: 'solid',
        background: 'both',
      },
    ],
  },
  close: {
    name: 'close',
    description: 'Close or cancel icon',
    altText: 'Close',
    category: 'actions',
    tags: ['close', 'cancel', 'dismiss', 'remove'],
    variants: [
      {
        id: 'close-line',
        path: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
        viewBox: '0 0 24 24',
        style: 'line',
        background: 'both',
      },
    ],
  },
  arrowRight: {
    name: 'arrow-right',
    description: 'Right arrow icon indicating forward direction',
    altText: 'Next',
    category: 'navigation',
    tags: ['arrow', 'right', 'next', 'forward'],
    variants: [
      {
        id: 'arrow-right-line',
        path: 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z',
        viewBox: '0 0 24 24',
        style: 'line',
        background: 'both',
      },
    ],
  },
  arrowLeft: {
    name: 'arrow-left',
    description: 'Left arrow icon indicating backward direction',
    altText: 'Previous',
    category: 'navigation',
    tags: ['arrow', 'left', 'previous', 'back'],
    variants: [
      {
        id: 'arrow-left-line',
        path: 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z',
        viewBox: '0 0 24 24',
        style: 'line',
        background: 'both',
      },
    ],
  },
  info: {
    name: 'info',
    description: 'Information icon',
    altText: 'Information',
    category: 'status',
    tags: ['info', 'information', 'help', 'details'],
    variants: [
      {
        id: 'info-line',
        path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
        viewBox: '0 0 24 24',
        style: 'line',
        background: 'both',
      },
    ],
  },
  warning: {
    name: 'warning',
    description: 'Warning icon',
    altText: 'Warning',
    category: 'status',
    tags: ['warning', 'alert', 'caution'],
    variants: [
      {
        id: 'warning-line',
        path: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
        viewBox: '0 0 24 24',
        style: 'line',
        background: 'both',
      },
    ],
  },
  error: {
    name: 'error',
    description: 'Error icon',
    altText: 'Error',
    category: 'status',
    tags: ['error', 'failure', 'problem'],
    variants: [
      {
        id: 'error-line',
        path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
        viewBox: '0 0 24 24',
        style: 'line',
        background: 'both',
      },
    ],
  },
  search: {
    name: 'search',
    description: 'Search icon',
    altText: 'Search',
    category: 'actions',
    tags: ['search', 'find', 'magnify'],
    variants: [
      {
        id: 'search-line',
        path: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
        viewBox: '0 0 24 24',
        style: 'line',
        background: 'both',
      },
    ],
  },
};

/**
 * Get icon by name
 */
export function getIcon(name: string): IconDefinition | undefined {
  return INCLUSIVE_ICONS[name];
}

/**
 * Get icon variant
 */
export function getIconVariant(
  iconName: string,
  variantId?: string
): IconVariant | undefined {
  const icon = getIcon(iconName);
  if (!icon) {
    return undefined;
  }

  if (variantId) {
    return icon.variants.find((v) => v.id === variantId);
  }

  // Return first variant by default
  return icon.variants[0];
}

/**
 * Get icon variant for specific background
 */
export function getIconForBackground(
  iconName: string,
  background: 'light' | 'dark',
  style: 'line' | 'solid' = 'line'
): IconVariant | undefined {
  const icon = getIcon(iconName);
  if (!icon) {
    return undefined;
  }

  return icon.variants.find(
    (v) =>
      v.style === style &&
      (v.background === background || v.background === 'both')
  );
}

/**
 * Generate SVG markup for an icon
 */
export function generateIconSVG(
  iconName: string,
  options: {
    variantId?: string;
    background?: 'light' | 'dark';
    style?: 'line' | 'solid';
    size?: number;
    color?: string;
    className?: string;
    ariaLabel?: string;
  } = {}
): string {
  const {
    variantId,
    background,
    style = 'line',
    size = 24,
    color = 'currentColor',
    className = '',
    ariaLabel,
  } = options;

  let variant: IconVariant | undefined;

  if (variantId) {
    variant = getIconVariant(iconName, variantId);
  } else if (background) {
    variant = getIconForBackground(iconName, background, style);
  } else {
    variant = getIconVariant(iconName);
  }

  if (!variant) {
    return '';
  }

  const icon = getIcon(iconName);
  const altText = ariaLabel || icon?.altText || iconName;
  const ariaAttributes = ariaLabel
    ? `aria-label="${altText}" role="img"`
    : 'aria-hidden="true"';

  return `
    <svg
      width="${size}"
      height="${size}"
      viewBox="${variant.viewBox}"
      fill="${color}"
      class="inclusive-icon ${className}"
      ${ariaAttributes}
    >
      <path d="${variant.path}" />
      ${ariaLabel ? `<title>${altText}</title>` : ''}
    </svg>
  `;
}

/**
 * Get all icons in a category
 */
export function getIconsByCategory(category: string): IconDefinition[] {
  return Object.values(INCLUSIVE_ICONS).filter(
    (icon) => icon.category === category
  );
}

/**
 * Search icons by tag
 */
export function searchIcons(query: string): IconDefinition[] {
  const lowerQuery = query.toLowerCase();
  return Object.values(INCLUSIVE_ICONS).filter(
    (icon) =>
      icon.name.toLowerCase().includes(lowerQuery) ||
      icon.description.toLowerCase().includes(lowerQuery) ||
      icon.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Validate icon accessibility
 */
export function validateIconAccessibility(iconName: string): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const icon = getIcon(iconName);

  if (!icon) {
    issues.push(`Icon "${iconName}" not found`);
    return { isValid: false, issues };
  }

  if (!icon.altText || icon.altText.trim().length === 0) {
    issues.push('Icon missing alt text');
  }

  if (icon.variants.length === 0) {
    issues.push('Icon has no variants');
  }

  // Check if variants have proper viewBox
  for (const variant of icon.variants) {
    if (!variant.viewBox || variant.viewBox.split(' ').length !== 4) {
      issues.push(`Variant ${variant.id} has invalid viewBox`);
    }
    if (!variant.path || variant.path.trim().length === 0) {
      issues.push(`Variant ${variant.id} has no path data`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Default export
 */
export default {
  icons: INCLUSIVE_ICONS,
  getIcon,
  getIconVariant,
  getIconForBackground,
  generateSVG: generateIconSVG,
  getByCategory: getIconsByCategory,
  search: searchIcons,
  validate: validateIconAccessibility,
};

