import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  localCredentialStore,
  type StoredCredential,
} from '../../src/services/LocalCredentialStore';
import { walletSyncService } from '../../src/services/WalletSyncService';
import { walletTheme } from '../../src/theme';

function formatExpiry(expiresAt?: string): string {
  if (!expiresAt) {
    return 'No expiry';
  }

  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) {
    return 'Expiry unavailable';
  }

  return expiry.toLocaleDateString();
}

function statusColor(status: StoredCredential['status']): string {
  switch (status) {
    case 'REVOKED':
      return walletTheme.danger;
    case 'EXPIRED':
      return walletTheme.warning;
    case 'SUSPENDED':
      return '#f97316';
    default:
      return walletTheme.success;
  }
}

export default function WalletScreen() {
  const router = useRouter();
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [npi, setNpi] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCredType, setNewCredType] = useState('');
  const [newCredIssuer, setNewCredIssuer] = useState('');
  const [newCredClaims, setNewCredClaims] = useState('');
  const [addingCredential, setAddingCredential] = useState(false);

  const loadWallet = async (withSync: boolean): Promise<void> => {
    setRefreshing(true);

    try {
      const storedNpi = await localCredentialStore.getStoredNpi();
      setNpi(storedNpi);

      if (withSync && storedNpi && (await walletSyncService.isApiReachable())) {
        await walletSyncService.sync(storedNpi);
      }

      setCredentials(await localCredentialStore.listCredentials());
      setError(null);
    } catch (caughtError) {
      setCredentials(await localCredentialStore.listCredentials());
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to refresh wallet');
    } finally {
      setRefreshing(false);
    }
  };

  const handleAddCredential = async (): Promise<void> => {
    try {
      setAddingCredential(true);

      if (!newCredType.trim()) {
        throw new Error('Credential type is required');
      }

      const holderDid = await localCredentialStore.getHolderDid();
      const storedNpi = await localCredentialStore.getStoredNpi();

      let claims: Record<string, unknown> = {};
      if (newCredClaims.trim()) {
        try {
          claims = JSON.parse(newCredClaims);
        } catch {
          throw new Error('Invalid JSON format for claims');
        }
      }

      const newCredential: StoredCredential = {
        id: `cred_${Date.now()}`,
        npi: storedNpi ?? 'unknown',
        type: newCredType.trim(),
        issuer: newCredIssuer.trim() || 'Self-issued',
        status: 'VALID',
        issuedAt: new Date().toISOString(),
        vcJwt: '',
        claims,
        issuerDid: holderDid,
        proofAlgorithm: 'ES256',
      };

      await localCredentialStore.storeCredential(newCredential);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setNewCredType('');
      setNewCredIssuer('');
      setNewCredClaims('');
      setShowAddModal(false);

      await loadWallet(false);
    } catch (caughtError) {
      Alert.alert(
        'Error',
        caughtError instanceof Error ? caughtError.message : 'Failed to add credential',
      );
    } finally {
      setAddingCredential(false);
    }
  };

  useEffect(() => {
    void loadWallet(true);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={credentials}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadWallet(true)}
            tintColor={walletTheme.accent}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Credential Wallet</Text>
            <Text style={styles.subtitle}>
              {npi ? `NPI ${npi}` : 'Store credentials locally for offline presentation.'}
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={styles.addButton} onPress={() => setShowAddModal(true)}>
              <Ionicons name="add-circle-outline" size={20} color={walletTheme.accentStrong} />
              <Text style={styles.addButtonText}>Add Credential</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No credentials stored</Text>
            <Text style={styles.emptyBody}>
              Use Settings to save an NPI, then pull to sync from the VitalCV API.
            </Text>
          </View>
        }
        contentContainerStyle={styles.content}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/credential-detail?id=${item.id}`);
            }}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.type}</Text>
              <View style={[styles.statusBadge, { borderColor: statusColor(item.status) }]}>
                <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
                  {item.status}
                </Text>
              </View>
            </View>

            <Text style={styles.metaText}>{item.issuer}</Text>
            <Text style={styles.metaText}>Issued {new Date(item.issuedAt).toLocaleDateString()}</Text>
            <Text style={styles.metaText}>Expires {formatExpiry(item.expiresAt)}</Text>

            <View style={styles.claimsRow}>
              {Object.keys(item.claims).slice(0, 3).map((claim) => (
                <View key={claim} style={styles.claimChip}>
                  <Text style={styles.claimChipText}>{claim}</Text>
                </View>
              ))}
            </View>
          </Pressable>
        )}
      />
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable style={styles.modalCloseButton} onPress={() => setShowAddModal(false)}>
              <Ionicons name="close" size={24} color={walletTheme.text} />
            </Pressable>
            <Text style={styles.modalTitle}>Add Credential</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalSubtitle}>
              Manually add a credential to your wallet. This is useful for testing or credentials
              that aren't available through the API.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Credential Type *</Text>
              <TextInput
                value={newCredType}
                onChangeText={setNewCredType}
                placeholder="e.g., MedicalLicense, BoardCertification"
                placeholderTextColor={walletTheme.textMuted}
                style={styles.formInput}
                autoFocus
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Issuer</Text>
              <TextInput
                value={newCredIssuer}
                onChangeText={setNewCredIssuer}
                placeholder="e.g., State Medical Board"
                placeholderTextColor={walletTheme.textMuted}
                style={styles.formInput}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Claims (JSON)</Text>
              <TextInput
                value={newCredClaims}
                onChangeText={setNewCredClaims}
                placeholder='{"licenseNumber": "12345", "specialty": "Cardiology"}'
                placeholderTextColor={walletTheme.textMuted}
                multiline
                numberOfLines={4}
                style={styles.formInput}
              />
            </View>

            <Pressable
              style={[styles.submitButton, addingCredential && styles.submitButtonDisabled]}
              onPress={() => void handleAddCredential()}
              disabled={addingCredential}
            >
              <Text style={styles.submitButtonText}>
                {addingCredential ? 'Adding...' : 'Add Credential'}
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: walletTheme.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 32,
    gap: 14,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 18,
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
  },
  error: {
    color: walletTheme.danger,
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: walletTheme.panel,
    borderColor: walletTheme.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    gap: 8,
  },
  emptyTitle: {
    color: walletTheme.text,
    fontSize: 18,
    fontWeight: '600',
  },
  emptyBody: {
    color: walletTheme.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    backgroundColor: walletTheme.panel,
    borderColor: walletTheme.border,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    gap: 8,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    color: walletTheme.text,
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metaText: {
    color: walletTheme.textMuted,
    fontSize: 14,
  },
  claimsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  claimChip: {
    backgroundColor: walletTheme.panelMuted,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  claimChipText: {
    color: walletTheme.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: walletTheme.panelMuted,
    borderRadius: 16,
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  addButtonText: {
    color: walletTheme.accentStrong,
    fontSize: 15,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: walletTheme.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: walletTheme.border,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalTitle: {
    color: walletTheme.text,
    fontSize: 18,
    fontWeight: '600',
  },
  modalContent: {
    padding: 18,
    gap: 20,
  },
  modalSubtitle: {
    color: walletTheme.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  formGroup: {
    gap: 8,
  },
  formLabel: {
    color: walletTheme.text,
    fontSize: 15,
    fontWeight: '600',
  },
  formInput: {
    backgroundColor: walletTheme.panelMuted,
    borderRadius: 16,
    borderColor: walletTheme.border,
    borderWidth: 1,
    color: walletTheme.text,
    fontSize: 16,
    padding: 14,
  },
  submitButton: {
    backgroundColor: walletTheme.accentStrong,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 12,
  },
  submitButtonDisabled: {
    backgroundColor: walletTheme.panelMuted,
  },
  submitButtonText: {
    color: walletTheme.background,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
