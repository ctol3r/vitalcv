import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { localCredentialStore } from '../../src/services/LocalCredentialStore';
import { notificationService } from '../../src/services/NotificationService';
import { walletSyncService } from '../../src/services/WalletSyncService';
import { walletTheme } from '../../src/theme';

export default function SettingsScreen() {
  const [npi, setNpi] = useState('');
  const [holderDid, setHolderDid] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [storedNpi, did] = await Promise.all([
        localCredentialStore.getStoredNpi(),
        localCredentialStore.getHolderDid(),
      ]);

      setNpi(storedNpi ?? '');
      setHolderDid(did);
    })();
  }, []);

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

        <Pressable style={styles.secondaryButton} onPress={clearWallet}>
          <Text style={styles.secondaryButtonText}>Clear Wallet</Text>
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
  secondaryButton: {
    alignItems: 'center',
    borderColor: walletTheme.danger,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 16,
  },
  secondaryButtonText: {
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
