# Client-Side PII Vault

This directory contains a simple example of a client-side vault for storing personally identifiable information (PII). The vault uses the Web Crypto API to encrypt data in the browser before sending it to any backend service.

The example exports two helpers in `client_vault.ts`:

- `encryptData(data: string, password: string): Promise<string>` – Encrypts a string with a password.
- `decryptData(payload: string, password: string): Promise<string>` – Decrypts an encrypted payload with the same password.

The encrypted payload is Base64 encoded and includes a random IV. This approach ensures that sensitive data is never transmitted in plain text, aligning with privacy-by-design principles.
