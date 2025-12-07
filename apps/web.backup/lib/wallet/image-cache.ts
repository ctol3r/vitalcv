/**
 * Image Cache
 * Caches issuer logos and credential thumbnails
 */

const IMAGE_CACHE = new Map<string, string>();
const MAX_CACHE_SIZE = 50;

export class ImageCache {
  static async get(url: string): Promise<string | null> {
    if (!url) return null;

    // Check memory cache
    if (IMAGE_CACHE.has(url)) {
      return IMAGE_CACHE.get(url) || null;
    }

    // Check browser cache
    try {
      const response = await fetch(url, { cache: 'force-cache' });
      if (response.ok) {
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        // Store in memory cache
        if (IMAGE_CACHE.size >= MAX_CACHE_SIZE) {
          // Remove oldest entry
          const firstKey = IMAGE_CACHE.keys().next().value;
          if (firstKey) {
            const oldUrl = IMAGE_CACHE.get(firstKey);
            if (oldUrl) URL.revokeObjectURL(oldUrl);
            IMAGE_CACHE.delete(firstKey);
          }
        }

        IMAGE_CACHE.set(url, objectUrl);
        return objectUrl;
      }
    } catch (error) {
      console.warn('[ImageCache] Failed to cache image:', error);
    }

    return null;
  }

  static clear(): void {
    IMAGE_CACHE.forEach((url) => URL.revokeObjectURL(url));
    IMAGE_CACHE.clear();
  }
}








