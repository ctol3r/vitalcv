import * as Keychain from 'react-native-keychain';
import CryptoJS from 'crypto-js';
import { getVaultSecret } from './keys';

const VAULT_SERVICE = 'vitalcv_mobile_vault';

export interface VaultCredential {
  id: string;
  type: string;
  issuer: string;
  sdJwt?: string;
  createdAt: string;
  fields: Record<string, unknown>;
}

export interface VaultProof {
  id: string;
  credentialId: string;
  audience: string;
  createdAt: string;
  sdJwt: string;
  disclosedFields: string[];
}

export interface VaultState {
  credentials: VaultCredential[];
  proofs: VaultProof[];
}

export async function loadVault(): Promise<VaultState> {
  const secret = await getVaultSecret();
  const record = await Keychain.getInternetCredentials(VAULT_SERVICE);
  if (!record?.password) {
    const empty: VaultState = { credentials: [], proofs: [] };
    await persistVault(empty, secret);
    return empty;
  }

  try {
    const decrypted = decrypt(record.password, secret);
    return JSON.parse(decrypted) as VaultState;
  } catch {
    return { credentials: [], proofs: [] };
  }
}

export async function addCredential(entry: VaultCredential): Promise<VaultState> {
  const secret = await getVaultSecret();
  const state = await loadVault();
  const next: VaultState = {
    ...state,
    credentials: [entry, ...state.credentials.filter((cred) => cred.id !== entry.id)],
  };
  await persistVault(next, secret);
  return next;
}

export async function deleteCredential(id: string): Promise<VaultState> {
  const secret = await getVaultSecret();
  const state = await loadVault();
  const next: VaultState = {
    credentials: state.credentials.filter((cred) => cred.id !== id),
    proofs: state.proofs.filter((proof) => proof.credentialId !== id),
  };
  await persistVault(next, secret);
  return next;
}

export async function recordProof(entry: VaultProof): Promise<VaultState> {
  const secret = await getVaultSecret();
  const state = await loadVault();
  const next: VaultState = {
    ...state,
    proofs: [entry, ...state.proofs.filter((proof) => proof.id !== entry.id)],
  };
  await persistVault(next, secret);
  return next;
}

export async function backupVault(): Promise<string> {
  const record = await Keychain.getInternetCredentials(VAULT_SERVICE);
  return record?.password ?? '';
}

export async function restoreVault(encryptedPayload: string): Promise<void> {
  await Keychain.setInternetCredentials(VAULT_SERVICE, 'vault', encryptedPayload, {
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function persistVault(state: VaultState, secret: string): Promise<void> {
  const encrypted = encrypt(JSON.stringify(state), secret);
  await Keychain.setInternetCredentials(VAULT_SERVICE, 'vault', encrypted, {
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

function encrypt(payload: string, secret: string): string {
  return CryptoJS.AES.encrypt(payload, secret).toString();
}

function decrypt(payload: string, secret: string): string {
  const bytes = CryptoJS.AES.decrypt(payload, secret);
  return bytes.toString(CryptoJS.enc.Utf8);
}










