import * as Keychain from 'react-native-keychain';

const CLIP_KEY_SERVICE = 'vitalcv_appclip_keys';
const CLIP_CREDENTIAL_SERVICE = 'vitalcv_appclip_credentials';
const FULL_KEY_SERVICE = 'vitalcv_mobile_keys';
const FULL_CREDENTIAL_SERVICE = 'vitalcv_mobile_credentials';

export interface MigrationReport {
  keysImported: number;
  credentialsImported: number;
  clearedAppClip: boolean;
  warnings: string[];
}

export async function migrateFromAppClip(): Promise<MigrationReport> {
  const report: MigrationReport = {
    keysImported: 0,
    credentialsImported: 0,
    clearedAppClip: false,
    warnings: [],
  };

  try {
    const clipKeys = await Keychain.getInternetCredentials(CLIP_KEY_SERVICE);
    if (clipKeys?.password) {
      await Keychain.setInternetCredentials(FULL_KEY_SERVICE, clipKeys.username ?? 'clip', clipKeys.password);
      report.keysImported = 1;
    } else {
      report.warnings.push('No App Clip signing keys found.');
    }

    const clipCreds = await Keychain.getInternetCredentials(CLIP_CREDENTIAL_SERVICE);
    if (clipCreds?.password) {
      let parsedLength = 1;
      try {
        const parsed = JSON.parse(clipCreds.password);
        if (Array.isArray(parsed)) {
          parsedLength = parsed.length;
        }
      } catch {
        report.warnings.push('Stored credential payload was not valid JSON.');
      }
      await Keychain.setInternetCredentials(
        FULL_CREDENTIAL_SERVICE,
        clipCreds.username ?? 'clip-wallet',
        clipCreds.password,
      );
      report.credentialsImported = parsedLength;
    } else {
      report.warnings.push('No App Clip credentials cached.');
    }

    await Keychain.resetInternetCredentials(CLIP_KEY_SERVICE);
    await Keychain.resetInternetCredentials(CLIP_CREDENTIAL_SERVICE);
    report.clearedAppClip = true;
  } catch (error) {
    report.warnings.push(error instanceof Error ? error.message : 'Unknown migration error');
  }

  return report;
}

export async function hasClipResidue(): Promise<boolean> {
  const keys = await Keychain.getInternetCredentials(CLIP_KEY_SERVICE);
  const creds = await Keychain.getInternetCredentials(CLIP_CREDENTIAL_SERVICE);
  return Boolean(keys || creds);
}










