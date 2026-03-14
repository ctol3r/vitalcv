import { useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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

export default function WalletScreen(): JSX.Element {
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [npi, setNpi] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          <View style={styles.card}>
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
          </View>
        )}
      />
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
});
