/**
 * PWAManifestGenerator
 *
 * Generates manifest.json with:
 * - App name, icons, theme colours, start URL, display mode, background colour
 * - Supports multiple icon sizes
 * - Updates when app metadata changes
 */

export interface PWAManifest {
  name: string;
  short_name: string;
  description?: string;
  start_url: string;
  display: 'fullscreen' | 'standalone' | 'minimal-ui' | 'browser';
  background_color: string;
  theme_color: string;
  orientation?: 'portrait' | 'landscape' | 'any';
  icons: Array<{
    src: string;
    sizes: string;
    type: string;
    purpose?: 'any' | 'maskable' | 'monochrome';
  }>;
  categories?: string[];
  screenshots?: Array<{
    src: string;
    sizes: string;
    type: string;
  }>;
  shortcuts?: Array<{
    name: string;
    short_name?: string;
    description?: string;
    url: string;
    icons?: Array<{
      src: string;
      sizes: string;
    }>;
  }>;
}

export interface PWAManifestConfig {
  name: string;
  shortName: string;
  description?: string;
  startUrl?: string;
  display?: PWAManifest['display'];
  backgroundColor?: string;
  themeColor?: string;
  orientation?: PWAManifest['orientation'];
  iconBasePath?: string;
  iconSizes?: number[];
  categories?: string[];
}

/**
 * PWA manifest generator
 */
export class PWAManifestGenerator {
  private defaultConfig: Required<Omit<PWAManifestConfig, 'description' | 'categories'>> & {
    description?: string;
    categories?: string[];
  } = {
    name: 'VitalCV',
    shortName: 'VitalCV',
    startUrl: '/',
    display: 'standalone',
    backgroundColor: '#ffffff',
    themeColor: '#0066cc',
    orientation: 'any',
    iconBasePath: '/icons',
    iconSizes: [72, 96, 128, 144, 152, 192, 384, 512],
  };

  /**
   * Generate manifest.json content
   */
  generateManifest(config: PWAManifestConfig): PWAManifest {
    const mergedConfig = { ...this.defaultConfig, ...config };

    const icons = this.generateIcons(mergedConfig);
    const shortcuts = this.generateShortcuts(mergedConfig);

    const manifest: PWAManifest = {
      name: mergedConfig.name,
      short_name: mergedConfig.shortName,
      description: mergedConfig.description,
      start_url: mergedConfig.startUrl,
      display: mergedConfig.display,
      background_color: mergedConfig.backgroundColor,
      theme_color: mergedConfig.themeColor,
      orientation: mergedConfig.orientation,
      icons,
    };

    if (mergedConfig.categories && mergedConfig.categories.length > 0) {
      manifest.categories = mergedConfig.categories;
    }

    if (shortcuts.length > 0) {
      manifest.shortcuts = shortcuts;
    }

    return manifest;
  }

  /**
   * Generate icon entries for manifest
   */
  private generateIcons(
    config: Required<Omit<PWAManifestConfig, 'description' | 'categories'>> & {
      description?: string;
      categories?: string[];
    },
  ): PWAManifest['icons'] {
    const icons: PWAManifest['icons'] = [];

    for (const size of config.iconSizes) {
      // Generate multiple icon entries for different purposes
      icons.push({
        src: `${config.iconBasePath}/icon-${size}x${size}.png`,
        sizes: `${size}x${size}`,
        type: 'image/png',
        purpose: 'any',
      });

      // Add maskable icon (for Android adaptive icons)
      if (size >= 192) {
        icons.push({
          src: `${config.iconBasePath}/icon-${size}x${size}-maskable.png`,
          sizes: `${size}x${size}`,
          type: 'image/png',
          purpose: 'maskable',
        });
      }
    }

    return icons;
  }

  /**
   * Generate app shortcuts
   */
  private generateShortcuts(
    config: Required<Omit<PWAManifestConfig, 'description' | 'categories'>> & {
      description?: string;
      categories?: string[];
    },
  ): PWAManifest['shortcuts'] {
    // Default shortcuts for common actions
    const shortcuts: PWAManifest['shortcuts'] = [
      {
        name: 'Search',
        short_name: 'Search',
        description: 'Search for providers',
        url: '/search',
        icons: [
          {
            src: `${config.iconBasePath}/shortcut-search.png`,
            sizes: '96x96',
          },
        ],
      },
      {
        name: 'Profile',
        short_name: 'Profile',
        description: 'View your profile',
        url: '/profile',
        icons: [
          {
            src: `${config.iconBasePath}/shortcut-profile.png`,
            sizes: '96x96',
          },
        ],
      },
    ];

    return shortcuts;
  }

  /**
   * Generate manifest as JSON string
   */
  generateManifestJSON(config: PWAManifestConfig): string {
    const manifest = this.generateManifest(config);
    return JSON.stringify(manifest, null, 2);
  }

  /**
   * Update manifest when app metadata changes
   */
  updateManifest(
    existingManifest: PWAManifest,
    updates: Partial<PWAManifestConfig>,
  ): PWAManifest {
    const config: PWAManifestConfig = {
      name: existingManifest.name,
      shortName: existingManifest.short_name,
      description: existingManifest.description,
      startUrl: existingManifest.start_url,
      display: existingManifest.display,
      backgroundColor: existingManifest.background_color,
      themeColor: existingManifest.theme_color,
      orientation: existingManifest.orientation,
      categories: existingManifest.categories,
    };

    const updatedConfig = { ...config, ...updates };
    return this.generateManifest(updatedConfig);
  }

  /**
   * Validate manifest configuration
   */
  validateConfig(config: PWAManifestConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.name || config.name.trim().length === 0) {
      errors.push('name is required');
    }

    if (!config.shortName || config.shortName.trim().length === 0) {
      errors.push('shortName is required');
    }

    if (config.startUrl && !config.startUrl.startsWith('/')) {
      errors.push('startUrl must start with /');
    }

    if (config.backgroundColor && !this.isValidColor(config.backgroundColor)) {
      errors.push('backgroundColor must be a valid hex color');
    }

    if (config.themeColor && !this.isValidColor(config.themeColor)) {
      errors.push('themeColor must be a valid hex color');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if color is valid hex format
   */
  private isValidColor(color: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }

  /**
   * Generate manifest with default values
   */
  generateDefaultManifest(): PWAManifest {
    return this.generateManifest(this.defaultConfig);
  }
}

export const pwaManifestGenerator = new PWAManifestGenerator();

