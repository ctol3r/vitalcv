/**
 * Wedge Tab Layout — wave-121
 * Two tabs only: Home (NPI entry) + Readiness detail.
 * No wallet. No dashboard. No features.
 */
import { Tabs } from 'expo-router';
import { walletTheme as t } from '../../src/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: t.panel,
          borderTopColor: t.border,
        },
        tabBarActiveTintColor: t.accentStrong,
        tabBarInactiveTintColor: t.textMuted,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Check NPI',
          tabBarIcon: ({ color }) => (
            <TabIcon symbol="⚡" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="readiness"
        options={{
          title: 'Readiness',
          tabBarIcon: ({ color }) => (
            <TabIcon symbol="✓" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

import { Text } from 'react-native';
function TabIcon({ symbol, color }: { symbol: string; color: string }) {
  return <Text style={{ fontSize: 16, color }}>{symbol}</Text>;
}
