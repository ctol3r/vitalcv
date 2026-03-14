import { VitalCVWallet, type WalletCredential } from '@vitalcv/wallet-sdk';

import {
  localCredentialStore,
  type StoredCredential,
} from './LocalCredentialStore';
import { notificationService } from './NotificationService';

const DEFAULT_API_BASE_URL =
  process.env.EXPO_PUBLIC_VITALCV_API_BASE_URL ?? 'https://api.vitalcv.com';

export class WalletSyncService {
  constructor(
    private readonly baseUrl: string = DEFAULT_API_BASE_URL,
    private readonly credentialStore = localCredentialStore,
  ) {}

  async isApiReachable(): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });

      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  async sync(npi: string): Promise<StoredCredential[]> {
    const wallet = new VitalCVWallet({
      baseUrl: this.baseUrl,
      npi,
      localMode: true,
    });
    const apiCredentials = (await wallet.listCredentials()) as WalletCredential[];
    const syncedCredentials = await this.credentialStore.syncFromApi(apiCredentials);

    await this.credentialStore.setStoredNpi(npi);
    await notificationService.scheduleCredentialExpiryReminders(syncedCredentials);

    return syncedCredentials;
  }
}

export const walletSyncService = new WalletSyncService();
