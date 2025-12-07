import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { ensureDidKeypair } from '../services/keys';
import { loadVault } from '../services/vault';

type HomeProps = BottomTabScreenProps<any, 'Home'> & {
  migrationBanner?: string | null;
};

export function HomeScreen({ navigation, migrationBanner }: HomeProps) {
  const [did, setDid] = useState<string>('');
  const [vaultCount, setVaultCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([ensureDidKeypair(), loadVault()]).then(([pair, vault]) => {
      setDid(pair.did);
      setVaultCount(vault.credentials.length);
      setLoading(false);
    });
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.heading}>Mobile Wallet</Text>
        {loading ? (
          <ActivityIndicator />
        ) : (
          <>
            <Text style={styles.label}>Device DID</Text>
            <Text selectable style={styles.value}>
              {did}
            </Text>
            <Text style={styles.label}>Stored credentials</Text>
            <Text style={styles.value}>{vaultCount}</Text>
          </>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Credentials')}>
          <Text style={styles.actionText}>View credentials</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Scan')}>
          <Text style={styles.actionText}>Scan QR</Text>
        </TouchableOpacity>
      </View>

      {migrationBanner && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{migrationBanner}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 16,
  },
  card: {
    borderRadius: 16,
    backgroundColor: '#0f172a',
    padding: 20,
    gap: 12,
  },
  heading: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  label: {
    color: '#94a3b8',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  value: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionText: {
    color: '#fff',
    fontWeight: '600',
  },
  banner: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 12,
  },
  bannerText: {
    color: '#e2e8f0',
    fontSize: 13,
  },
});










