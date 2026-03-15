import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  localCredentialStore,
  type StoredCredential,
} from '../../src/services/LocalCredentialStore';
import {
  offlinePresentationEngine,
  type OfflinePresentation,
} from '../../src/services/OfflinePresentationEngine';
import { walletTheme } from '../../src/theme';

function collectClaimNames(credentials: StoredCredential[]): string[] {
  return Array.from(
    new Set(credentials.flatMap((credential) => Object.keys(credential.claims))),
  ).sort();
}

async function authenticate(): Promise<boolean> {
  const availability = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();

  if (!availability || !enrolled) {
    return true;
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Approve credential presentation',
    disableDeviceFallback: false,
  });

  return result.success;
}

export default function PresentScreen() {
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedClaims, setSelectedClaims] = useState<string[]>([]);
  const [presentation, setPresentation] = useState<OfflinePresentation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void localCredentialStore.listCredentials().then((storedCredentials) => {
      setCredentials(storedCredentials);
      setSelectedIds(storedCredentials.map((credential) => credential.id));
    });
  }, []);

  const selectedCredentials = useMemo(
    () => credentials.filter((credential) => selectedIds.includes(credential.id)),
    [credentials, selectedIds],
  );
  const availableClaims = useMemo(
    () => collectClaimNames(selectedCredentials),
    [selectedCredentials],
  );

  const toggleCredential = (credentialId: string): void => {
    setSelectedIds((currentIds) =>
      currentIds.includes(credentialId)
        ? currentIds.filter((id) => id !== credentialId)
        : [...currentIds, credentialId],
    );
  };

  const toggleClaim = (claimName: string): void => {
    setSelectedClaims((currentClaims) =>
      currentClaims.includes(claimName)
        ? currentClaims.filter((claim) => claim !== claimName)
        : [...currentClaims, claimName],
    );
  };

  const createPresentation = async (): Promise<void> => {
    try {
      if (selectedIds.length === 0) {
        throw new Error('Select at least one credential');
      }

      const approved = await authenticate();
      if (!approved) {
        throw new Error('Biometric approval was cancelled');
      }

      const nextPresentation = await offlinePresentationEngine.createPresentation({
        credentialIds: selectedIds,
        disclosedClaims: selectedClaims,
      });

      setPresentation(nextPresentation);
      setError(null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : 'Unable to create presentation',
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Present Offline</Text>
          <Text style={styles.subtitle}>
            Choose credentials, limit disclosed claims, then unlock with biometrics.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Credentials</Text>
          {credentials.map((credential) => (
            <Pressable
              key={credential.id}
              onPress={() => toggleCredential(credential.id)}
              style={[
                styles.selectorCard,
                selectedIds.includes(credential.id) && styles.selectorCardActive,
              ]}
            >
              <Text style={styles.selectorTitle}>{credential.type}</Text>
              <Text style={styles.selectorBody}>{credential.issuer}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Selective Disclosure</Text>
          {availableClaims.length === 0 ? (
            <Text style={styles.helperText}>Select credentials to reveal available claims.</Text>
          ) : (
            <View style={styles.claimGrid}>
              {availableClaims.map((claim) => (
                <Pressable
                  key={claim}
                  onPress={() => toggleClaim(claim)}
                  style={[
                    styles.claimChip,
                    selectedClaims.includes(claim) && styles.claimChipActive,
                  ]}
                >
                  <Text style={styles.claimChipLabel}>{claim}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <Pressable style={styles.primaryButton} onPress={() => void createPresentation()}>
          <Text style={styles.primaryButtonText}>Create VP</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {presentation ? (
          <View style={styles.presentationCard}>
            <Text style={styles.sectionTitle}>VP QR Code</Text>
            <View style={styles.qrCard}>
              <QRCode value={presentation.qrData} size={200} backgroundColor="#ffffff" />
            </View>
            <Text style={styles.metaText}>Holder DID</Text>
            <Text selectable style={styles.payloadText}>
              {presentation.holderDid}
            </Text>
            <Text style={styles.metaText}>Compact VP JWT</Text>
            <Text selectable numberOfLines={10} style={styles.payloadText}>
              {presentation.vpJwt}
            </Text>
          </View>
        ) : null}
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
  sectionTitle: {
    color: walletTheme.text,
    fontSize: 18,
    fontWeight: '600',
  },
  helperText: {
    color: walletTheme.textMuted,
    fontSize: 14,
  },
  selectorCard: {
    backgroundColor: walletTheme.panelMuted,
    borderColor: 'transparent',
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  selectorCardActive: {
    borderColor: walletTheme.accent,
  },
  selectorTitle: {
    color: walletTheme.text,
    fontSize: 16,
    fontWeight: '600',
  },
  selectorBody: {
    color: walletTheme.textMuted,
    fontSize: 13,
  },
  claimGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  claimChip: {
    backgroundColor: walletTheme.panelMuted,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  claimChipActive: {
    backgroundColor: '#12324a',
  },
  claimChipLabel: {
    color: walletTheme.accent,
    fontSize: 13,
    fontWeight: '600',
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
  error: {
    color: walletTheme.danger,
    fontSize: 13,
  },
  presentationCard: {
    backgroundColor: walletTheme.panel,
    borderColor: walletTheme.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    padding: 18,
  },
  qrCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    marginVertical: 8,
    padding: 14,
  },
  metaText: {
    color: walletTheme.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  payloadText: {
    color: walletTheme.text,
    fontSize: 13,
    lineHeight: 19,
  },
});
