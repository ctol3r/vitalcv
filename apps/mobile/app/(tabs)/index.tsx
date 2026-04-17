/**
 * Wedge Home Screen — NPI Entry + Readiness Status
 * wave-121: Mobile Wedge Integration
 *
 * The ONLY entry point. Enter NPI → see readiness.
 * No wallet. No dashboard. No features.
 */
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { walletTheme as t } from '../../src/theme';
import { fetchReadiness, ReadinessResult } from '../../src/services/ReadinessService';

export default function HomeScreen() {
  const router = useRouter();
  const [npi, setNpi] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReadinessResult | null>(null);

  const handleCheck = useCallback(async () => {
    const clean = npi.trim().replace(/\D/g, '');
    if (clean.length !== 10) {
      setError('NPI must be 10 digits.');
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const data = await fetchReadiness(clean);
      setResult(data);
    } catch (err: any) {
      setError(err.message ?? 'Unable to check readiness.');
    } finally {
      setLoading(false);
    }
  }, [npi]);

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.flex}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={s.header}>
            <Text style={s.brand}>VitalCV</Text>
            <Text style={s.subtitle}>Credentialing Readiness</Text>
          </View>

          {/* NPI Input */}
          <View style={s.inputBlock}>
            <Text style={s.label}>Enter your NPI</Text>
            <TextInput
              style={s.input}
              value={npi}
              onChangeText={v => { setNpi(v); setError(null); setResult(null); }}
              placeholder="1234567890"
              placeholderTextColor={t.textMuted}
              keyboardType="numeric"
              maxLength={10}
              returnKeyType="done"
              onSubmitEditing={handleCheck}
            />
            {error && <Text style={s.errorText}>{error}</Text>}
          </View>

          {/* CTA */}
          <Pressable
            style={[s.button, (loading || npi.trim().length === 0) && s.buttonDisabled]}
            onPress={handleCheck}
            disabled={loading || npi.trim().length === 0}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.buttonText}>Check Readiness</Text>
            }
          </Pressable>

          {/* Readiness Result */}
          {result && !loading && (
            <View style={s.resultBlock}>
              <ReadinessCard result={result} onViewBlockers={() =>
                router.push({ pathname: '/(tabs)/readiness', params: { npi: result.npi } })
              } />
            </View>
          )}

          {/* What this checks */}
          {!result && !loading && (
            <View style={s.whatBlock}>
              <Text style={s.whatTitle}>What this checks</Text>
              <LaneRow label="NPPES Identity" live />
              <LaneRow label="OIG Exclusions" live={false} />
              <LaneRow label="State License" live={false} />
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ReadinessCard({ result, onViewBlockers }: {
  result: ReadinessResult;
  onViewBlockers: () => void;
}) {
  const postureColor = {
    decision_grade: t.success,
    partial: t.warning,
    checking: t.textMuted,
    blocked: t.danger,
    degraded: t.warning,
    unchecked: t.textMuted,
  }[result.posture] ?? t.textMuted;

  return (
    <View style={s.card}>
      <View style={s.cardRow}>
        <Text style={s.cardName}>{result.name}</Text>
        <View style={[s.postureDot, { backgroundColor: postureColor }]} />
      </View>
      <Text style={s.postureLabel}>{result.postureLabel}</Text>

      {result.score !== null && (
        <Text style={s.score}>{result.score}% coverage</Text>
      )}

      {result.nextStep && (
        <View style={s.nextStepBlock}>
          <Text style={s.nextStepLabel}>Next step</Text>
          <Text style={s.nextStepText}>{result.nextStep}</Text>
        </View>
      )}

      {result.pendingCount > 0 && (
        <Pressable style={s.blockerButton} onPress={onViewBlockers}>
          <Text style={s.blockerButtonText}>
            {result.pendingCount} pending source{result.pendingCount !== 1 ? 's' : ''} →
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function LaneRow({ label, live }: { label: string; live: boolean }) {
  return (
    <View style={s.laneRow}>
      <View style={[s.laneDot, { backgroundColor: live ? t.success : t.border }]} />
      <Text style={s.laneLabel}>{label}</Text>
      <Text style={[s.laneStatus, { color: live ? t.success : t.textMuted }]}>
        {live ? 'Live' : 'Coming'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: t.background },
  flex:           { flex: 1 },
  scroll:         { padding: 24, paddingBottom: 60 },
  header:         { marginBottom: 32 },
  brand:          { fontSize: 28, fontWeight: '800', color: t.text, letterSpacing: -0.5 },
  subtitle:       { fontSize: 14, color: t.textMuted, marginTop: 4 },
  inputBlock:     { marginBottom: 16 },
  label:          { fontSize: 13, fontWeight: '600', color: t.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  input:          { backgroundColor: t.panel, borderWidth: 1, borderColor: t.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 20, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: t.text, letterSpacing: 3, textAlign: 'center' },
  errorText:      { color: t.danger, fontSize: 13, marginTop: 6 },
  button:         { backgroundColor: t.accentStrong, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 24 },
  buttonDisabled: { opacity: 0.4 },
  buttonText:     { color: '#fff', fontSize: 15, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  resultBlock:    { marginBottom: 24 },
  card:           { backgroundColor: t.panel, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: t.border },
  cardRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardName:       { fontSize: 18, fontWeight: '700', color: t.text },
  postureDot:     { width: 10, height: 10, borderRadius: 5 },
  postureLabel:   { fontSize: 14, color: t.textMuted, marginBottom: 12 },
  score:          { fontSize: 22, fontWeight: '800', color: t.text, marginBottom: 12 },
  nextStepBlock:  { backgroundColor: t.panelMuted, borderRadius: 10, padding: 12, marginBottom: 12 },
  nextStepLabel:  { fontSize: 11, fontWeight: '700', color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  nextStepText:   { fontSize: 14, color: t.text, lineHeight: 20 },
  blockerButton:  { paddingVertical: 10, alignItems: 'flex-start' },
  blockerButtonText: { color: t.accentStrong, fontSize: 14, fontWeight: '600' },
  whatBlock:      { marginTop: 8 },
  whatTitle:      { fontSize: 12, fontWeight: '700', color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  laneRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border },
  laneDot:        { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  laneLabel:      { flex: 1, fontSize: 14, color: t.text },
  laneStatus:     { fontSize: 12, fontWeight: '600' },
});
