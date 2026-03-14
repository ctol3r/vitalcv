import * as LocalAuthentication from 'expo-local-authentication';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { oid4vpHandler } from '../../src/services/OID4VPHandler';
import type { StoredCredential } from '../../src/services/LocalCredentialStore';
import { walletTheme } from '../../src/theme';

async function authenticate(): Promise<boolean> {
  const availability = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();

  if (!availability || !enrolled) {
    return true;
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Approve OID4VP response',
  });

  return result.success;
}

export default function ScanScreen(): JSX.Element {
  const [permission, requestPermission] = useCameraPermissions();
  const [requestUri, setRequestUri] = useState('');
  const [matchedCredentials, setMatchedCredentials] = useState<StoredCredential[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [requestSummary, setRequestSummary] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRequest = async (uri: string): Promise<void> => {
    try {
      const parsed = oid4vpHandler.parseRequest(uri);
      const credentials = await oid4vpHandler.selectCredentials(parsed);

      setRequestUri(uri);
      setRequestSummary(parsed.presentation_definition.name ?? parsed.client_id);
      setMatchedCredentials(credentials);
      setSelectedIds(credentials.map((credential) => credential.id));
      setError(null);
      setResultMessage(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to parse OID4VP request');
    }
  };

  const onBarcodeScanned = (scan: BarcodeScanningResult): void => {
    if (!requestUri) {
      void loadRequest(scan.data);
    }
  };

  const toggleCredential = (credentialId: string): void => {
    setSelectedIds((currentIds) =>
      currentIds.includes(credentialId)
        ? currentIds.filter((id) => id !== credentialId)
        : [...currentIds, credentialId],
    );
  };

  const respond = async (): Promise<void> => {
    try {
      if (!requestUri) {
        throw new Error('Scan or paste an OID4VP request first');
      }

      const approved = await authenticate();
      if (!approved) {
        throw new Error('Biometric approval was cancelled');
      }

      const handled = await oid4vpHandler.handleRequest(requestUri, {
        credentialIds: selectedIds,
      });

      setResultMessage(
        handled.submitted
          ? `Submitted presentation to verifier (${handled.statusCode ?? 200}).`
          : 'Created offline presentation. Network submission was skipped.',
      );
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to respond to verifier');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Scan OID4VP</Text>
          <Text style={styles.subtitle}>
            Scan a verifier QR request or paste the `openid4vp://` URI directly.
          </Text>
        </View>

        <View style={styles.section}>
          {permission?.granted ? (
            <View style={styles.cameraFrame}>
              <CameraView
                style={StyleSheet.absoluteFill}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={onBarcodeScanned}
              />
            </View>
          ) : (
            <Pressable style={styles.secondaryButton} onPress={() => void requestPermission()}>
              <Text style={styles.secondaryButtonText}>Enable Camera</Text>
            </Pressable>
          )}

          <TextInput
            value={requestUri}
            onChangeText={setRequestUri}
            placeholder="openid4vp://?client_id=..."
            placeholderTextColor={walletTheme.textMuted}
            style={styles.input}
            multiline
          />

          <Pressable style={styles.secondaryButton} onPress={() => void loadRequest(requestUri)}>
            <Text style={styles.secondaryButtonText}>Parse Request</Text>
          </Pressable>
        </View>

        {requestSummary ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Verifier Request</Text>
            <Text style={styles.helperText}>{requestSummary}</Text>
            {matchedCredentials.map((credential) => (
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
            <Pressable style={styles.primaryButton} onPress={() => void respond()}>
              <Text style={styles.primaryButtonText}>Respond</Text>
            </Pressable>
          </View>
        ) : null}

        {resultMessage ? <Text style={styles.success}>{resultMessage}</Text> : null}
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
    gap: 14,
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
  cameraFrame: {
    borderRadius: 18,
    height: 220,
    overflow: 'hidden',
  },
  input: {
    backgroundColor: walletTheme.panelMuted,
    borderRadius: 16,
    color: walletTheme.text,
    minHeight: 96,
    padding: 14,
    textAlignVertical: 'top',
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
    borderColor: walletTheme.border,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: walletTheme.text,
    fontSize: 15,
    fontWeight: '600',
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
