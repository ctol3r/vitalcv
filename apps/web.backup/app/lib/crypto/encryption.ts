
export interface EncryptedData {
  ciphertext: string; // Base64 encoded
  iv: string;         // Base64 encoded
  salt: string;       // Base64 encoded
}

/**
 * Derives a cryptographic key from a passphrase and salt using PBKDF2.
 * @param passphrase The user's passphrase
 * @param salt The salt (random bytes)
 * @returns CryptoKey for AES-GCM
 */
export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts data using AES-GCM.
 * @param data The plaintext data (string or object, will be JSON stringified)
 * @param passphrase The passphrase to derive the key from
 * @returns EncryptedData object
 */
export async function encrypt(data: any, passphrase: string): Promise<EncryptedData> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);

  const enc = new TextEncoder();
  const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
  const encodedData = enc.encode(plaintext);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encodedData
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: uint8ArrayToBase64(iv),
    salt: uint8ArrayToBase64(salt),
  };
}

/**
 * Decrypts data using AES-GCM.
 * @param encryptedData The EncryptedData object
 * @param passphrase The passphrase to derive the key from
 * @returns The decrypted data (parsed JSON if possible, else string)
 */
export async function decrypt(encryptedData: EncryptedData, passphrase: string): Promise<any> {
  const salt = base64ToUint8Array(encryptedData.salt);
  const iv = base64ToUint8Array(encryptedData.iv);
  const ciphertext = base64ToArrayBuffer(encryptedData.ciphertext);

  const key = await deriveKey(passphrase, salt);

  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    const decryptedString = dec.decode(decryptedBuffer);

    try {
      return JSON.parse(decryptedString);
    } catch (e) {
      return decryptedString;
    }
  } catch (e) {
    throw new Error("Decryption failed. Incorrect passphrase or corrupted data.");
  }
}

// Helper functions for Base64 conversion
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}



















