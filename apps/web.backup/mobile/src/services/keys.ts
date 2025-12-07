import 'react-native-get-random-values';
import * as Keychain from 'react-native-keychain';
import { getPublicKey, utils as edUtils } from '@noble/ed25519';

const DID_KEY_SERVICE = 'vitalcv_did_keypair';
const DPOP_KEY_SERVICE = 'vitalcv_dpop_key';
const VAULT_SECRET_SERVICE = 'vitalcv_vault_secret';

export interface DidKeyPair {
  did: string;
  publicKey: string;
  privateKey: string;
}

export interface DPopKeyPair {
  publicKey: string;
  privateKey: string;
}

export async function ensureDidKeypair(): Promise<DidKeyPair> {
  const existing = await Keychain.getGenericPassword({ service: DID_KEY_SERVICE });
  if (existing?.password) {
    return JSON.parse(existing.password) as DidKeyPair;
  }

  const privateKey = edUtils.randomPrivateKey();
  const publicKey = await getPublicKey(privateKey);
  const did = `did:key:z${Buffer.from(publicKey).toString('base64url')}`;

  const pair: DidKeyPair = {
    did,
    publicKey: Buffer.from(publicKey).toString('hex'),
    privateKey: Buffer.from(privateKey).toString('hex'),
  };

  await Keychain.setGenericPassword('did', JSON.stringify(pair), {
    service: DID_KEY_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  return pair;
}

export async function ensureDpopKey(): Promise<DPopKeyPair> {
  const existing = await Keychain.getGenericPassword({ service: DPOP_KEY_SERVICE });
  if (existing?.password) {
    return JSON.parse(existing.password) as DPopKeyPair;
  }

  const privateKey = edUtils.randomPrivateKey();
  const publicKey = await getPublicKey(privateKey);
  const pair: DPopKeyPair = {
    publicKey: Buffer.from(publicKey).toString('hex'),
    privateKey: Buffer.from(privateKey).toString('hex'),
  };

  await Keychain.setGenericPassword('dpop', JSON.stringify(pair), {
    service: DPOP_KEY_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  return pair;
}

export async function getVaultSecret(): Promise<string> {
  const existing = await Keychain.getGenericPassword({ service: VAULT_SECRET_SERVICE });
  if (existing?.password) {
    return existing.password;
  }

  const secret = Buffer.from(edUtils.randomBytes(32)).toString('hex');
  await Keychain.setGenericPassword('vault', secret, {
    service: VAULT_SECRET_SERVICE,
    accessible: Keychain.ACCESSIBLE.ALWAYS_THIS_DEVICE_ONLY,
  });
  return secret;
}










