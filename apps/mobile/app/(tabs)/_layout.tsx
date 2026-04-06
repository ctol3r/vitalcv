import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { walletTheme } from '../../src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: walletTheme.background,
        },
        tabBarStyle: {
          backgroundColor: walletTheme.panel,
          borderTopColor: walletTheme.border,
        },
        tabBarActiveTintColor: walletTheme.accent,
        tabBarInactiveTintColor: walletTheme.textMuted,
      }}
    >
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="present"
        options={{
          title: 'Present',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="qr-code-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="credential-detail"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
