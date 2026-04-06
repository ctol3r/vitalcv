import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  localCredentialStore,
  type StoredCredential,
} from '../../src/services/LocalCredentialStore';
import { walletTheme } from '../../src/theme';

export default function CredentialDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [credential, setCredential] = useState<StoredCredential | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const loadedCredential = id ? await localCredentialStore.getCredential(id) : null;
        setCredential(loadedCredential);
      } catch (error) {
        Alert.alert('Error', 'Failed to load credential');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const deleteCredential = (): void => {
    if (!credential) return;

    Alert.alert('Delete Credential', `Remove ${credential.type} from your wallet?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await localCredentialStore.removeCredential(credential.id);
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete credential');
            }
          })();
        },
      },
    ]);
  };

  const statusColor = (): string => {
    if (!credential) return walletTheme.textMuted;
    switch (credential.status) {
      case 'REVOKED':
        return walletTheme.danger;
      case 'EXPIRED':
        return walletTheme.warning;
      case 'SUSPENDED':
        return '#f97316';
      default:
        return walletTheme.success;
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'Unknown';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!credential) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={walletTheme.danger} />
          <Text style={styles.errorTitle}>Credential Not Found</Text>
          <Text style={styles.errorText}>This credential may have been deleted.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={walletTheme.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Credential Details</Text>
          <Pressable style={styles.menuButton} onPress={deleteCredential}>
            <Ionicons name="trash-outline" size={24} color={walletTheme.danger} />
          </Pressable>
        </View>

        {/* Credential Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconContainer}>
              <Ionicons name="card-outline" size={32} color={walletTheme.accent} />
            </View>
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardTitle}>{credential.type}</Text>
              <Text style={styles.cardIssuer}>{credential.issuer}</Text>
            </View>
            <View style={[styles.statusBadge, { borderColor: statusColor() }]}>
              <Text style={[styles.statusText, { color: statusColor() }]}>
                {credential.status}
              </Text>
            </View>
          </View>
        </View>

        {/* Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Validity</Text>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={20} color={walletTheme.textMuted} />
            <View style={styles.dateInfo}>
              <Text style={styles.dateLabel}>Issued</Text>
              <Text style={styles.dateValue}>{formatDate(credential.issuedAt)}</Text>
            </View>
          </View>
          {credential.expiresAt && (
            <View style={styles.dateRow}>
              <Ionicons name="time-outline" size={20} color={walletTheme.textMuted} />
              <View style={styles.dateInfo}>
                <Text style={styles.dateLabel}>Expires</Text>
                <Text style={styles.dateValue}>{formatDate(credential.expiresAt)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Claims */}
        {Object.keys(credential.claims).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Claims</Text>
            {Object.entries(credential.claims).map(([key, value]) => (
              <View key={key} style={styles.claimRow}>
                <Text style={styles.claimKey}>{key}</Text>
                <Text style={styles.claimValue}>
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Technical Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Technical Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Credential ID</Text>
            <Text selectable style={styles.detailValue}>
              {credential.id}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Issuer DID</Text>
            <Text selectable style={styles.detailValue}>
              {credential.issuerDid}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Proof Algorithm</Text>
            <Text style={styles.detailValue}>{credential.proofAlgorithm}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>NPI</Text>
            <Text selectable style={styles.detailValue}>
              {credential.npi}
            </Text>
          </View>
        </View>

        {/* JWT */}
        {credential.vcJwt && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Verifiable Credential JWT</Text>
            <View style={styles.jwtContainer}>
              <Text selectable numberOfLines={10} style={styles.jwtText}>
                {credential.vcJwt}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: walletTheme.background,
  },
  content: {
    padding: 18,
    gap: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: walletTheme.textMuted,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 24,
  },
  errorTitle: {
    color: walletTheme.text,
    fontSize: 20,
    fontWeight: '600',
  },
  errorText: {
    color: walletTheme.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 4,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: walletTheme.text,
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  menuButton: {
    padding: 8,
  },
  card: {
    backgroundColor: walletTheme.panel,
    borderColor: walletTheme.border,
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  cardIconContainer: {
    backgroundColor: walletTheme.panelMuted,
    borderRadius: 16,
    padding: 12,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    color: walletTheme.text,
    fontSize: 18,
    fontWeight: '600',
  },
  cardIssuer: {
    color: walletTheme.textMuted,
    fontSize: 14,
    marginTop: 2,
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
    marginBottom: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateInfo: {
    flex: 1,
  },
  dateLabel: {
    color: walletTheme.textMuted,
    fontSize: 13,
  },
  dateValue: {
    color: walletTheme.text,
    fontSize: 15,
    fontWeight: '500',
  },
  claimRow: {
    backgroundColor: walletTheme.panelMuted,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  claimKey: {
    color: walletTheme.textMuted,
    fontSize: 14,
  },
  claimValue: {
    color: walletTheme.text,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    color: walletTheme.textMuted,
    fontSize: 13,
  },
  detailValue: {
    color: walletTheme.accent,
    fontSize: 13,
    lineHeight: 18,
  },
  jwtContainer: {
    backgroundColor: walletTheme.panelMuted,
    borderRadius: 12,
    padding: 12,
  },
  jwtText: {
    color: walletTheme.textMuted,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
});
