import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { loadVault, deleteCredential, type VaultCredential } from '../services/vault';

export function CredentialListScreen() {
  const [credentials, setCredentials] = useState<VaultCredential[]>([]);

  useEffect(() => {
    loadVault().then((vault) => setCredentials(vault.credentials));
  }, []);

  const handleDelete = async (id: string) => {
    const next = await deleteCredential(id);
    setCredentials(next.credentials);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Stored credentials</Text>
      {credentials.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No credentials saved yet.</Text>
        </View>
      ) : (
        <FlatList
          data={credentials}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 12 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.type}</Text>
              <Text style={styles.cardSubtitle}>{item.issuer}</Text>
              <Text style={styles.cardMeta}>Saved {new Date(item.createdAt).toLocaleString()}</Text>
              <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
  },
  card: {
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    gap: 6,
  },
  cardTitle: {
    fontWeight: '600',
    fontSize: 16,
  },
  cardSubtitle: {
    color: '#475569',
  },
  cardMeta: {
    color: '#94a3b8',
    fontSize: 12,
  },
  deleteButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  deleteText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '600',
  },
});










