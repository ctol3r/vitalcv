/**
 * LocalDataStore
 * Manages local data storage using IndexedDB for offline support
 * Provides async storage operations with fallback to localStorage
 */

interface StoreOptions {
  key: string;
  data: unknown;
  expiresAt?: number; // Unix timestamp
}

class LocalDataStore {
  private dbName = 'vitalcv-local-store';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private useIndexedDB: boolean = false;

  constructor() {
    if (typeof window === 'undefined') return;
    this.init();
  }

  private async init(): Promise<void> {
    if (!('indexedDB' in window)) {
      console.warn('IndexedDB not available, falling back to localStorage');
      return;
    }

    try {
      this.db = await this.openDB();
      this.useIndexedDB = true;
    } catch (error) {
      console.warn('Failed to initialize IndexedDB, falling back to localStorage:', error);
    }
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('data')) {
          db.createObjectStore('data', { keyPath: 'key' });
        }
      };
    });
  }

  async save(options: StoreOptions): Promise<void> {
    const { key, data, expiresAt } = options;

    if (this.useIndexedDB && this.db) {
      return this.saveToIndexedDB(key, data, expiresAt);
    } else {
      return this.saveToLocalStorage(key, data, expiresAt);
    }
  }

  private async saveToIndexedDB(
    key: string,
    data: unknown,
    expiresAt?: number,
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['data'], 'readwrite');
      const store = transaction.objectStore('data');
      const request = store.put({
        key,
        data,
        expiresAt: expiresAt || null,
        createdAt: Date.now(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private saveToLocalStorage(key: string, data: unknown, expiresAt?: number): void {
    try {
      const item = {
        data,
        expiresAt: expiresAt || null,
        createdAt: Date.now(),
      };
      localStorage.setItem(`vitalcv-${key}`, JSON.stringify(item));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      throw error;
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    if (this.useIndexedDB && this.db) {
      return this.getFromIndexedDB<T>(key);
    } else {
      return this.getFromLocalStorage<T>(key);
    }
  }

  private async getFromIndexedDB<T>(key: string): Promise<T | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['data'], 'readonly');
      const store = transaction.objectStore('data');
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }

        // Check expiration
        if (result.expiresAt && result.expiresAt < Date.now()) {
          this.delete(key);
          resolve(null);
          return;
        }

        resolve(result.data as T);
      };

      request.onerror = () => reject(request.error);
    });
  }

  private getFromLocalStorage<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(`vitalcv-${key}`);
      if (!item) return null;

      const parsed = JSON.parse(item);

      // Check expiration
      if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
        this.delete(key);
        return null;
      }

      return parsed.data as T;
    } catch (error) {
      console.error('Failed to get from localStorage:', error);
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    if (this.useIndexedDB && this.db) {
      return this.deleteFromIndexedDB(key);
    } else {
      return this.deleteFromLocalStorage(key);
    }
  }

  private async deleteFromIndexedDB(key: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['data'], 'readwrite');
      const store = transaction.objectStore('data');
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private deleteFromLocalStorage(key: string): void {
    try {
      localStorage.removeItem(`vitalcv-${key}`);
    } catch (error) {
      console.error('Failed to delete from localStorage:', error);
    }
  }

  async getAllKeys(): Promise<string[]> {
    if (this.useIndexedDB && this.db) {
      return this.getAllKeysFromIndexedDB();
    } else {
      return this.getAllKeysFromLocalStorage();
    }
  }

  private async getAllKeysFromIndexedDB(): Promise<string[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['data'], 'readonly');
      const store = transaction.objectStore('data');
      const request = store.getAllKeys();

      request.onsuccess = () => {
        const keys = request.result as string[];
        resolve(keys);
      };

      request.onerror = () => reject(request.error);
    });
  }

  private getAllKeysFromLocalStorage(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('vitalcv-')) {
        keys.push(key.replace('vitalcv-', ''));
      }
    }
    return keys;
  }

  async clear(): Promise<void> {
    if (this.useIndexedDB && this.db) {
      return this.clearIndexedDB();
    } else {
      return this.clearLocalStorage();
    }
  }

  private async clearIndexedDB(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['data'], 'readwrite');
      const store = transaction.objectStore('data');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private clearLocalStorage(): void {
    const keys = this.getAllKeysFromLocalStorage();
    keys.forEach((key) => {
      localStorage.removeItem(`vitalcv-${key}`);
    });
  }
}

// Export singleton instance
export const localDataStore = new LocalDataStore();

