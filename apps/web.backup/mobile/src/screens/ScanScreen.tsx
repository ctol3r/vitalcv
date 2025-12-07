import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import QRCodeScanner from 'react-native-qrcode-scanner';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { loadVault, recordProof } from '../services/vault';
import { ensureDidKeypair } from '../services/keys';
import { Buffer } from 'buffer';

interface OidcRequest {
  verifier?: { displayName?: string };
  presentation_definition?: { id?: string };
  response_uri?: string;
  state?: string;
  nonce?: string;
}

export function ScanScreen() {
  const [requestPayload, setRequestPayload] = useState<OidcRequest | null>(null);
  const [status, setStatus] = useState<string>('Ready to scan');

  useEffect(() => {
    requestCameraPermission();
  }, []);

  const requestCameraPermission = async () => {
    const result = await request(
      Platform.select({
        ios: PERMISSIONS.IOS.CAMERA,
        android: PERMISSIONS.ANDROID.CAMERA,
        default: PERMISSIONS.ANDROID.CAMERA,
      })!,
    );
    if (result !== RESULTS.GRANTED) {
      Alert.alert('Camera permission required', 'Enable camera access to scan QR codes.');
    }
  };

  const handleScan = async ({ data }: { data: string }) => {
    try {
      const parsed = parseQr(data);
      setRequestPayload(parsed);
      setStatus('Verifier request loaded. Review and share.');
    } catch (error) {
      Alert.alert('Invalid QR code', error instanceof Error ? error.message : 'Unable to parse QR payload');
    }
  };

  const handleShareProof = async () => {
    if (!requestPayload) return;
    const vault = await loadVault();
    if (vault.credentials.length === 0) {
      Alert.alert('No credentials', 'Save a credential before sharing.');
      return;
    }

    const credential = vault.credentials[0];
    if (!credential.sdJwt) {
      Alert.alert('Unsupported credential', 'Credential is missing SD-JWT payload.');
      return;
    }

    const did = await ensureDidKeypair();
    const submissionId = `mobile-${Date.now()}`;
    const body = {
      vp_token: credential.sdJwt,
      presentation_submission: {
        id: submissionId,
        definition_id: requestPayload.presentation_definition?.id ?? 'mobile',
        descriptor_map: [],
      },
      state: requestPayload.state,
      holder: did.did,
    };

    const endpoint = requestPayload.response_uri;
    if (!endpoint) {
      Alert.alert('Missing endpoint', 'Verifier did not provide a response URI.');
      return;
    }

    setStatus('Submitting proof...');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      setStatus('Verifier rejected submission');
      Alert.alert('Submission failed', `Verifier responded with ${response.status}`);
      return;
    }

    await recordProof({
      id: submissionId,
      credentialId: credential.id,
      audience: requestPayload.verifier?.displayName ?? 'Verifier',
      createdAt: new Date().toISOString(),
      sdJwt: credential.sdJwt,
      disclosedFields: Object.keys(credential.fields ?? {}),
    });

    setStatus('Proof shared successfully');
    Alert.alert('Success', 'Verifier accepted your proof.');
  };

  return (
    <View style={styles.container}>
      {!requestPayload ? (
        <QRCodeScanner onRead={handleScan} topContent={<Text style={styles.instructions}>Scan verifier QR to share proofs.</Text>} />
      ) : (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Verifier request</Text>
          <Text style={styles.summaryLabel}>Verifier</Text>
          <Text style={styles.summaryValue}>{requestPayload.verifier?.displayName ?? 'Unknown'}</Text>
          <Text style={styles.summaryLabel}>Definition</Text>
          <Text style={styles.summaryValue}>{requestPayload.presentation_definition?.id ?? 'Not specified'}</Text>
          <Text style={styles.status}>{status}</Text>
          <TouchableOpacity style={styles.shareButton} onPress={handleShareProof}>
            <Text style={styles.shareText}>Share proof</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resetButton} onPress={() => setRequestPayload(null)}>
            <Text style={styles.resetText}>Scan another</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function parseQr(data: string): OidcRequest {
  if (data.startsWith('openid4vp://')) {
    const search = data.split('?')[1];
    const params = new URLSearchParams(search);
    const request = params.get('request');
    if (request) {
      const decoded = JSON.parse(Buffer.from(request, 'base64').toString('utf-8'));
      return decoded;
    }
  }

  if (data.startsWith('{')) {
    return JSON.parse(data) as OidcRequest;
  }

  throw new Error('Unsupported QR payload');
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  instructions: {
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  summary: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
    gap: 12,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  summaryLabel: {
    color: '#94a3b8',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  shareButton: {
    marginTop: 12,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  shareText: {
    color: '#fff',
    fontWeight: '700',
  },
  resetButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    alignItems: 'center',
  },
  resetText: {
    color: '#1e293b',
    fontWeight: '600',
  },
  status: {
    color: '#475569',
    marginTop: 8,
  },
});

