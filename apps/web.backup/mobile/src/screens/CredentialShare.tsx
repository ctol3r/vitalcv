import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type CredentialCard = {
  id: string;
  title: string;
  type: 'license' | 'board' | 'employment';
  issuedAt: string;
  expiresAt?: string;
};

const SAMPLE_CREDENTIALS: CredentialCard[] = [
  {
    id: 'VC-LIC-7823',
    title: 'CA Medical License',
    type: 'license',
    issuedAt: '2024-10-01',
    expiresAt: '2026-10-01',
  },
  {
    id: 'VC-BOARD-1880',
    title: 'ABIM Cardiology',
    type: 'board',
    issuedAt: '2023-06-12',
    expiresAt: '2028-06-12',
  },
  {
    id: 'VC-EMP-9920',
    title: 'Aurora Metro Health (FT)',
    type: 'employment',
    issuedAt: '2022-01-05',
  },
];

export const CredentialShareScreen = () => {
  const [selected, setSelected] = useState<CredentialCard | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const proofPayload = useMemo(() => {
    if (!selected) return null;
    const sdJwt = generateSdJwtProof(selected.id);
    const requestId = `share-${selected.id}-${Date.now().toString(36)}`;
    return {
      sdJwt,
      requestId,
      deepLink: `vitalcv://clip/claim?requestId=${encodeURIComponent(requestId)}&proof=${encodeURIComponent(
        sdJwt,
      )}`,
    };
  }, [selected]);

  const handleShare = (credential: CredentialCard) => {
    setSelected(credential);
    setModalVisible(true);
  };

  const openAppClip = () => {
    if (!proofPayload?.deepLink) return;
    Linking.openURL(proofPayload.deepLink).catch((error) => {
      console.warn('Failed to open App Clip link', error);
    });
  };

  const renderItem = ({ item }: { item: CredentialCard }) => (
    <Pressable style={styles.card} onPress={() => handleShare(item)}>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardMeta}>{item.id}</Text>
      <Text style={styles.cardMeta}>
        Issued {new Date(item.issuedAt).toLocaleDateString()}
        {item.expiresAt ? ` · Expires ${new Date(item.expiresAt).toLocaleDateString()}` : ''}
      </Text>
      <Text style={styles.cardCta}>Share via App Clip →</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Share credentials</Text>
      <Text style={styles.subtitle}>
        Choose a credential to generate an SD-JWT presentation and handoff to the App Clip.
      </Text>
      <FlatList
        data={SAMPLE_CREDENTIALS}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Share via App Clip</Text>
            {selected && proofPayload ? (
              <>
                <Text style={styles.modalText}>Credential: {selected.title}</Text>
                <Text style={styles.modalText}>Request ID: {proofPayload.requestId}</Text>
                <View style={styles.proofBox}>
                  <Text style={styles.proofLabel}>SD-JWT Proof</Text>
                  <Text style={styles.proofValue}>{proofPayload.sdJwt}</Text>
                </View>
                <Pressable style={styles.primaryButton} onPress={openAppClip}>
                  <Text style={styles.primaryButtonText}>Open App Clip</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.modalText}>Preparing proof...</Text>
            )}
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                setModalVisible(false);
                setSelected(null);
              }}
            >
              <Text style={styles.secondaryButtonText}>Dismiss</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

function generateSdJwtProof(credentialId: string): string {
  const random = Math.random().toString(36).slice(2, 12);
  return `sdjwt.${credentialId}.${random}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#f5f5f7',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#5a5a5c',
    marginBottom: 16,
  },
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardMeta: {
    fontSize: 12,
    color: '#6c6c6e',
    marginTop: 4,
  },
  cardCta: {
    marginTop: 12,
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '500',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: '#444',
    marginBottom: 8,
  },
  proofBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  proofLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  proofValue: {
    fontSize: 13,
    color: '#fff',
    fontFamily: 'Courier',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#6b7280',
    fontWeight: '500',
  },
});










