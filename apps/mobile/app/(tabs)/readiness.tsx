/**
 * Readiness Detail Screen
 * wave-121: Mobile Wedge Integration
 *
 * Shows each source lane with its SYSTEM state (not judgment).
 * Uses truth-contract label map — same as web.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { walletTheme as t } from '../../src/theme';
import { fetchReadiness, ReadinessResult, LaneDetail } from '../../src/services/ReadinessService';

// Truth-contract label map (same source as web)
const SOURCE_STATUS_LABELS: Record<string, string> = {
  not_checked:     'Source not yet checked in this run',
  in_progress:     'Waiting for source response',
  verified:        'Verified',
  stale:           'Previously verified — refresh recommended',
  unavailable:     'Source temporarily unreachable',
  access_required: 'Institutional access required',
  review_required: 'Under manual review',
  adverse:         'Adverse finding — action required',
};

const STATUS_COLOR: Record<string, string> = {
  verified:        '#4ade80',
  stale:           '#fbbf24',
  adverse:         '#fb7185',
  unavailable:     '#97a5c0',
  access_required: '#97a5c0',
  not_checked:     '#223252',
  in_progress:     '#7dd3fc',
  review_required: '#fbbf24',
};

export default function ReadinessScreen() {
  const { npi } = useLocalSearchParams<{ npi: string }>();
  const router = useRouter();
  const [result, setResult] = useState<ReadinessResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!npi) return;
    fetchReadiness(npi)
      .then(setResult)
      .catch(e => setError(e.message ?? 'Error'))
      .finally(() => setLoading(false));
  }, [npi]);

  return (
    <SafeAreaView style={s.container}>
      <View style={s.navBar}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </Pressable>
        <Text style={s.navTitle}>Readiness</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading && (
        <View style={s.center}>
          <ActivityIndicator color={t.accentStrong} />
          <Text style={s.loadingText}>Checking sources…</Text>
        </View>
      )}

      {error && (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      {result && !loading && (
        <ScrollView contentContainerStyle={s.scroll}>

          {/* Provider identity */}
          <View style={s.identityBlock}>
            <Text style={s.providerName}>{result.name}</Text>
            <Text style={s.npiText}>NPI {result.npi}</Text>
          </View>

          {/* Posture */}
          <View style={s.postureBlock}>
            <Text style={s.postureLabel}>{result.postureLabel}</Text>
            {result.score !== null && (
              <Text style={s.score}>{result.score}% verified</Text>
            )}
          </View>

          {/* Lane breakdown */}
          <Text style={s.sectionTitle}>Source Coverage</Text>
          {result.lanes.map(lane => (
            <LaneCard key={lane.laneId} lane={lane} />
          ))}

          {/* Next step */}
          {result.nextStep && (
            <View style={s.nextBlock}>
              <Text style={s.nextLabel}>What to do next</Text>
              <Text style={s.nextText}>{result.nextStep}</Text>
            </View>
          )}

          {/* Continue to web passport */}
          <View style={s.webBlock}>
            <Text style={s.webHint}>Full passport and employer review available on the web.</Text>
            <Text style={s.webUrl}>vitalcv.com/passport/{result.npi}</Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function LaneCard({ lane }: { lane: LaneDetail }) {
  const color = STATUS_COLOR[lane.status] ?? t.textMuted;
  const label = SOURCE_STATUS_LABELS[lane.status] ?? lane.status;
  const isAdverse = lane.status === 'adverse';
  const isPending = ['not_checked', 'in_progress', 'unavailable', 'access_required'].includes(lane.status);

  return (
    <View style={[s.laneCard, isAdverse && s.laneCardAdverse]}>
      <View style={s.laneHeader}>
        <View style={[s.dot, { backgroundColor: color }]} />
        <Text style={s.laneName}>{lane.displayName}</Text>
      </View>
      <Text style={[s.laneStatus, { color }]}>{label}</Text>
      {lane.checkedAt && (
        <Text style={s.timestamp}>Checked {formatTime(lane.checkedAt)}</Text>
      )}
      {/* Explicit: pending is SYSTEM state, not clinician fault */}
      {isPending && (
        <Text style={s.systemNote}>This is a system state — not a reflection of your credentials.</Text>
      )}
    </View>
  );
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: t.background },
  navBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.border },
  backBtn:       { width: 60 },
  backText:      { color: t.accentStrong, fontSize: 15 },
  navTitle:      { fontSize: 16, fontWeight: '700', color: t.text },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText:   { color: t.textMuted, marginTop: 12, fontSize: 14 },
  errorText:     { color: t.danger, fontSize: 14, textAlign: 'center' },
  scroll:        { padding: 20, paddingBottom: 60 },
  identityBlock: { marginBottom: 16 },
  providerName:  { fontSize: 22, fontWeight: '800', color: t.text },
  npiText:       { fontSize: 13, color: t.textMuted, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  postureBlock:  { backgroundColor: t.panel, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: t.border },
  postureLabel:  { fontSize: 16, fontWeight: '700', color: t.text },
  score:         { fontSize: 28, fontWeight: '900', color: t.success, marginTop: 4 },
  sectionTitle:  { fontSize: 11, fontWeight: '700', color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  laneCard:      { backgroundColor: t.panel, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: t.border },
  laneCardAdverse: { borderColor: t.danger },
  laneHeader:    { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  dot:           { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  laneName:      { fontSize: 15, fontWeight: '600', color: t.text },
  laneStatus:    { fontSize: 13, marginBottom: 4 },
  timestamp:     { fontSize: 11, color: t.textMuted },
  systemNote:    { fontSize: 11, color: t.textMuted, fontStyle: 'italic', marginTop: 6, lineHeight: 16 },
  nextBlock:     { backgroundColor: t.panelMuted, borderRadius: 14, padding: 16, marginTop: 8, marginBottom: 16 },
  nextLabel:     { fontSize: 11, fontWeight: '700', color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  nextText:      { fontSize: 15, color: t.text, lineHeight: 22 },
  webBlock:      { borderTopWidth: 1, borderTopColor: t.border, paddingTop: 16 },
  webHint:       { fontSize: 13, color: t.textMuted, marginBottom: 6 },
  webUrl:        { fontSize: 13, color: t.accentStrong, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
});

import { Platform } from 'react-native';
