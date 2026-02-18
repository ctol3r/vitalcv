import { decodeJwt } from 'jose';
import { SimulatedWallet, VitalVC } from '../types/verifierWallet';
import { isStrictTransitionMode } from './haipPolicy';
import { assertActiveCredentialLifecycle, parseCredentialStatusArtifactId } from './credentialStatus';
import { validateVitalVC } from './vcIssuer';

type StoredCredentialRecord = {
  credential: VitalVC;
  rawVc: string;
};

type WalletStorageRecord = {
  id: string;
  organizationId: string;
  credentials: Map<string, StoredCredentialRecord>;
};

const walletStore = new Map<string, WalletStorageRecord>();

function toNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parseWalletOrganizationId(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function assertWalletCredentialUsable(credential: VitalVC): Promise<void> {
  const status = credential.credentialStatus;
  if (!status || typeof status !== 'object') {
    throw new Error('Wallet storage requires credentialStatus in strict mode.');
  }

  const artifactId = parseCredentialStatusArtifactId(status.id);
  if (!artifactId) {
    throw new Error('Invalid credentialStatus.id format.');
  }

  await assertActiveCredentialLifecycle(artifactId);
}

function parseCredentialFromJwt(vcJwt: string): VitalVC {
  const payload = decodeJwt(vcJwt) as { vc?: unknown };
  const vc = payload.vc;
  if (!vc || typeof vc !== 'object' || Array.isArray(vc)) {
    throw new Error('VC payload missing valid vc claim.');
  }
  const vcRecord = vc as Record<string, unknown>;

  const id = toNonEmptyString(vcRecord.id, 'vc.id');
  const issuer = toNonEmptyString(vcRecord.issuer, 'vc.issuer');
  const issuanceDate = toNonEmptyString(vcRecord.issuanceDate, 'vc.issuanceDate');
  const typeValue = vcRecord.type;
  if (!Array.isArray(typeValue) || typeValue.length === 0 || !typeValue.every((entry) => typeof entry === 'string')) {
    throw new Error('vc.type must be a non-empty string array.');
  }

  const contextValue = vcRecord['@context'];
  if (!Array.isArray(contextValue) || !contextValue.every((entry) => typeof entry === 'string')) {
    throw new Error('vc.@context must be an array of strings.');
  }

  const credentialSubject = toRecord(vcRecord.credentialSubject);
  return {
    '@context': contextValue,
    id,
    type: typeValue as string[],
    issuer,
    issuanceDate,
    credentialSubject: credentialSubject as Record<string, string | number | boolean | null>,
    ...(typeof vcRecord.organizationId === 'string' ? { organizationId: vcRecord.organizationId } : {}),
    ...(typeof vcRecord.organization_id === 'string'
      ? { organization_id: vcRecord.organization_id }
      : {}),
  };
}

function getCredentialOrganizationId(credential: VitalVC): string | undefined {
  return parseWalletOrganizationId(credential.organization_id) ?? parseWalletOrganizationId(credential.organizationId);
}

function getWallet(walletId: string): WalletStorageRecord {
  const existing = walletStore.get(walletId);
  if (existing) {
    return existing;
  }

  const created: WalletStorageRecord = {
    id: walletId,
    organizationId: '',
    credentials: new Map<string, StoredCredentialRecord>(),
  };
  walletStore.set(walletId, created);
  return created;
}

function cloneWallet(wallet: WalletStorageRecord): SimulatedWallet {
  return {
    id: wallet.id,
    organizationId: wallet.organizationId,
    storedCredentials: Array.from(wallet.credentials.values()).map((entry) => entry.credential),
  };
}

export async function storeCredential(
  walletId: string,
  vcJws: string,
  organizationId: string,
): Promise<SimulatedWallet> {
  const normalizedWalletId = toNonEmptyString(walletId, 'walletId');
  const credentialJwt = toNonEmptyString(vcJws, 'credential');

  let credential: VitalVC;
  if (isStrictTransitionMode()) {
    credential = await validateVitalVC(credentialJwt);
    await assertWalletCredentialUsable(credential);
  } else {
    credential = parseCredentialFromJwt(credentialJwt);
  }

  const normalizedOrganizationId = toNonEmptyString(organizationId, 'organizationId');
  const wallet = getWallet(normalizedWalletId);
  const credentialOrganizationId = getCredentialOrganizationId(credential);
  if (credentialOrganizationId && credentialOrganizationId !== normalizedOrganizationId) {
    throw new Error('Wallet organizationId does not match credential organizationId.');
  }

  if (wallet.organizationId && wallet.organizationId !== normalizedOrganizationId) {
    throw new Error('Wallet organizationId does not match existing wallet context.');
  }

  if (!wallet.organizationId) {
    wallet.organizationId = normalizedOrganizationId;
  }

  wallet.credentials.set(credential.id, {
    credential,
    rawVc: credentialJwt,
  });

  return cloneWallet(wallet);
}

export function listCredentials(walletId: string, organizationId: string): VitalVC[] {
  const normalizedWalletId = toNonEmptyString(walletId, 'walletId');
  const normalizedOrganizationId = toNonEmptyString(organizationId, 'organizationId');
  const wallet = walletStore.get(normalizedWalletId);
  if (!wallet) {
    return [];
  }
  if (wallet.organizationId !== normalizedOrganizationId) {
    return [];
  }
  return Array.from(wallet.credentials.values()).map((entry) => entry.credential);
}

export function getWalletRecord(walletId: string, organizationId: string): SimulatedWallet | null {
  const normalizedWalletId = walletId.trim();
  if (!normalizedWalletId) {
    return null;
  }
  const normalizedOrganizationId = organizationId.trim();
  if (!normalizedOrganizationId) {
    return null;
  }
  const wallet = walletStore.get(normalizedWalletId);
  if (!wallet) {
    return null;
  }
  if (wallet.organizationId !== normalizedOrganizationId) {
    return null;
  }
  return cloneWallet(wallet);
}

export async function verifyStoredCredential(
  walletId: string,
  vcId: string,
  organizationId: string,
): Promise<boolean> {
  const normalizedWalletId = toNonEmptyString(walletId, 'walletId');
  const normalizedVcId = toNonEmptyString(vcId, 'vcId');
  const normalizedOrganizationId = toNonEmptyString(organizationId, 'organizationId');

  const wallet = walletStore.get(normalizedWalletId);
  if (!wallet) {
    return false;
  }
  if (wallet.organizationId !== normalizedOrganizationId) {
    return false;
  }

  const record = wallet.credentials.get(normalizedVcId);
  if (!record) {
    return false;
  }

  try {
    await validateVitalVC(record.rawVc);
    return true;
  } catch {
    return false;
  }
}
