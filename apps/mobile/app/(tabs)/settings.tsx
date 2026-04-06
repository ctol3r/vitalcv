import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { localCredentialStore } from '../../src/services/LocalCredentialStore';
import { notificationService } from '../../src/services/NotificationService';
import { walletSyncService } from '../../src/services/WalletSyncService';
import { walletTheme } from '../../src/theme';

const BIOMETRIC_PREF_KEY = 'wallet:settings:biometric_enabled';
const NOTIFICATION_PREF_KEY = 'wallet:settings:notifications_enabled';
const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const [npi, setNpi] = useState('');
  const [holderDid, setHolderDid] = useState('');
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [storedNpi, did, bioPref, notifPref, hasHardware, isEnrolled] = await Promise.all([
        localCredentialStore.getStoredNpi(),
        localCredentialStore.getHolderDid(),
        SecureStore.getItemAsync(BIOMETRIC_PREF_KEY),
        SecureStore.getItemAsync(NOTIFICATION_PREF_KEY),
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);

      setNpi(storedNpi ?? '');
      setHolderDid(did);
      setBiometricAvailable(hasHardware && isEnrolled);
      setBiometricEnabled(bioPref === 'true');
      setNotificationsEnabled(notifPref !== 'false');
    })();
  }, []);

  const toggleBiometric = async (value: boolean): Promise<void> => {
    if (value) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm to enable biometrics',
      });
      if (!result.success) return;
    }
    setBiometricEnabled(value);
    await SecureStore.setItemAsync(BIOMETRIC_PREF_KEY, String(value));
  };

  const toggleNotifications = async (value: boolean): Promise<void> => {
    if (value) {
      const permissions = await Notifications.requestPermissionsAsync();
      if (!permissions.granted) {
        Alert.alert(
          'Notifications Disabled',
          'Enable notifications in your device settings to receive credential alerts.',
        );
        return;
      }
    }
    setNotificationsEnabled(value);
    await SecureStore.setItemAsync(NOTIFICATION_PREF_KEY, String(value));
    if (!value) {
      await notificationService.cancelAll();
    }
  };

  const syncWallet = async (): Promise<void> => {
    try {
      if (!npi.trim()) {
        throw new Error('Enter an NPI before syncing');
      }

      await localCredentialStore.setStoredNpi(npi.trim());
      await walletSyncService.sync(npi.trim());
      setHolderDid(await localCredentialStore.getHolderDid());
      setMessage('Wallet synced and notifications scheduled.');
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to sync wallet');
      setMessage(null);
    }
  };

  const clearWallet = (): void => {
    Alert.alert('Clear Wallet', 'Remove all local credentials and notifications?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await localCredentialStore.clearAll();
            await notificationService.cancelAll();
            setMessage('Local wallet cleared.');
            setError(null);
            setNpi('');
            setHolderDid(await localCredentialStore.getHolderDid());
          })();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>
            Manage the local holder identity and sync credentials from VitalCV.
          </Text>
        </View>

        {/* Identity & Sync */}
        <View style={styles.section}>
          <Text style={styles.label}>Clinician NPI</Text>
          <TextInput
            value={npi}
            onChangeText={setNpi}
            placeholder="1234567890"
            placeholderTextColor={walletTheme.textMuted}
            keyboardType="number-pad"
            style={styles.input}
          />

          <Pressable style={styles.primaryButton} onPress={() => void syncWallet()}>
            <Text style={styles.primaryButtonText}>Sync Wallet</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Holder DID</Text>
          <Text selectable style={styles.didText}>
            {holderDid}
          </Text>
        </View>

        {/* Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="finger-print-outline" size={22} color={walletTheme.accent} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Biometric Lock</Text>
                <Text style={styles.settingHint}>
                  {biometricAvailable
                    ? 'Require biometrics before presenting credentials'
                    : 'Not available on this device'}
                </Text>
              </View>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={(v) => void toggleBiometric(v)}
              disabled={!biometricAvailable}
              trackColor={{ false: walletTheme.panelMuted, true: walletTheme.accentStrong }}
              thumbColor={walletTheme.text}
            />
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications-outline" size={22} color={walletTheme.accent} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Expiry Reminders</Text>
                <Text style={styles.settingHint}>
                  Get notified 90, 30, and 7 days before credentials expire
                </Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={(v) => void toggleNotifications(v)}
              trackColor={{ false: walletTheme.panelMuted, true: walletTheme.accentStrong }}
              thumbColor={walletTheme.text}
            />
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>{APP_VERSION}</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Build</Text>
            <Text style={styles.aboutValue}>Expo SDK 52</Text>
          </View>
        </View>

        {/* Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <Pressable
            style={styles.linkRow}
            onPress={() => void Linking.openURL('https://vitalcv.com/privacy')}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={walletTheme.textMuted} />
            <Text style={styles.linkText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={18} color={walletTheme.textMuted} />
          </Pressable>
          <Pressable
            style={styles.linkRow}
            onPress={() => void Linking.openURL('https://vitalcv.com/terms')}
          >
            <Ionicons name="document-text-outline" size={20} color={walletTheme.textMuted} />
            <Text style={styles.linkText}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={18} color={walletTheme.textMuted} />
          </Pressable>
        </View>

        {/* Danger Zone */}
        <Pressable style={styles.dangerButton} onPress={clearWallet}>
          <Text style={styles.dangerButtonText}>Clear Wallet</Text>
        </Pressable>

        {message ? <Text style={styles.success}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: walletTheme.background,
  },
  content: {
    padding: 18,
    gap: 18,
    paddingBottom: 40,
  },
  header: {
    gap: 8,
  },
  title: {
    color: walletTheme.text,
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: walletTheme.textMuted,
    fontSize: 15,
    lineHeight: 21,
  },
  section: {
    backgroundColor: walletTheme.panel,
    borderColor: walletTheme.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  sectionTitle: {
    color: walletTheme.text,
    fontSize: 16,
    fontWeight: '600',
  },
  label: {
    color: walletTheme.text,
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    backgroundColor: walletTheme.panelMuted,
    borderRadius: 16,
    color: walletTheme.text,
    fontSize: 16,
    padding: 14,
  },
  didText: {
    color: walletTheme.accent,
    fontSize: 13,
    lineHeight: 19,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    color: walletTheme.text,
    fontSize: 15,
    fontWeight: '600',
  },
  settingHint: {
    color: walletTheme.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aboutLabel: {
    color: walletTheme.textMuted,
    fontSize: 14,
  },
  aboutValue: {
    color: walletTheme.text,
    fontSize: 14,
    fontWeight: '500',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  linkText: {
    color: walletTheme.text,
    flex: 1,
    fontSize: 15,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: walletTheme.accentStrong,
    borderRadius: 18,
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: walletTheme.background,
    fontSize: 16,
    fontWeight: '700',
  },
  dangerButton: {
    alignItems: 'center',
    borderColor: walletTheme.danger,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 16,
  },
  dangerButtonText: {
    color: walletTheme.danger,
    fontSize: 15,
    fontWeight: '700',
  },
  success: {
    color: walletTheme.success,
    fontSize: 14,
  },
  error: {
    color: walletTheme.danger,
    fontSize: 14,
  },
});
