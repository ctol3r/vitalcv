/**
 * Spotlight Search Support
 * Index credentials for browser/OS search
 */

import type { CredentialListItem } from './types';

export function indexCredentialForSearch(credential: CredentialListItem): void {
  if (typeof window === 'undefined') return;

  try {
    // Add to browser search index (if supported)
    if ('indexedDB' in window) {
      // Store in IndexedDB for search
      const dbName = 'vitalcv_search';
      const request = indexedDB.open(dbName, 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('credentials')) {
          db.createObjectStore('credentials', { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['credentials'], 'readwrite');
        const store = transaction.objectStore('credentials');
        store.put({
          id: credential.id,
          title: credential.title,
          issuer: credential.issuer.name,
          type: credential.type,
          status: credential.status,
          searchableText: `${credential.title} ${credential.issuer.name} ${credential.type}`.toLowerCase(),
        });
      };
    }
  } catch (error) {
    console.warn('[SpotlightSearch] Failed to index credential:', error);
  }
}

export function searchCredentials(query: string): Promise<CredentialListItem[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      resolve([]);
      return;
    }

    try {
      const dbName = 'vitalcv_search';
      const request = indexedDB.open(dbName, 1);

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['credentials'], 'readonly');
        const store = transaction.objectStore('credentials');
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => {
          const all = getAllRequest.result;
          const lowerQuery = query.toLowerCase();
          const matches = all.filter((item: any) =>
            item.searchableText.includes(lowerQuery)
          );
          resolve(matches as CredentialListItem[]);
        };

        getAllRequest.onerror = () => {
          resolve([]);
        };
      };

      request.onerror = () => {
        resolve([]);
      };
    } catch (error) {
      console.warn('[SpotlightSearch] Search failed:', error);
      resolve([]);
    }
  });
}








