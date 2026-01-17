/**
 * Credential Storage (IndexedDB)
 * Securely stores credentials in the browser using IndexedDB.
 */

const DB_NAME = 'VitalCV_Wallet';
const DB_VERSION = 1;
const STORE_NAME = 'credentials';

export interface StoredCredential {
  id: string; // unique ID (e.g. credential ID)
  type: string;
  issuer: string;
  issuedAt: string;
  expiresAt?: string;
  credential: string; // The full SD-JWT string
  format: 'vc+sd-jwt' | 'jwt_vc_json';
  status?: 'active' | 'revoked' | 'expired'; // Cached status
  claims?: Record<string, unknown>; // Parsed claims for display
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB not supported server-side'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function saveCredential(credential: StoredCredential): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(credential);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getCredential(id: string): Promise<StoredCredential | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getAllCredentials(): Promise<StoredCredential[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function deleteCredential(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
