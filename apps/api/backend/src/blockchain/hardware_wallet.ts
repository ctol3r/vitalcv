import { log } from '../obs/logger';

export interface HardwareWallet {
  connect(): Promise<void>;
  sign(data: Buffer): Promise<Buffer>;
  getPublicKey(): Promise<string>;
}

export class YubiKeyWallet implements HardwareWallet {
  async connect(): Promise<void> {
    log('info', 'Connecting to YubiKey');
  }

  async sign(data: Buffer): Promise<Buffer> {
    log('info', 'Signing with YubiKey', {
      event: 'hardware_wallet_yubikey_sign',
      bytes: data.length,
    });
    // In a real implementation this would interact with the device
    return data;
  }

  async getPublicKey(): Promise<string> {
    log('info', 'Retrieving public key from YubiKey');
    // Return a placeholder key for now
    return 'yubi-public-key';
  }
}

export class LedgerWallet implements HardwareWallet {
  async connect(): Promise<void> {
    log('info', 'Connecting to Ledger');
  }

  async sign(data: Buffer): Promise<Buffer> {
    log('info', 'Signing with Ledger', {
      event: 'hardware_wallet_ledger_sign',
      bytes: data.length,
    });
    // In a real implementation this would interact with the device
    return data;
  }

  async getPublicKey(): Promise<string> {
    log('info', 'Retrieving public key from Ledger');
    // Return a placeholder key for now
    return 'ledger-public-key';
  }
}
