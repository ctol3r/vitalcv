// SDK 56 forked react-navigation into expo-router: expo-router@56 declares no
// @react-navigation/* dependency and vendors its own copy, re-exporting the
// theming API. Importing from the standalone package still compiled, but the
// ThemeProvider would have supplied a context from a DIFFERENT react-navigation
// instance than expo-router's navigators consume — the theme would silently
// stop applying, with tsc green. Import from expo-router so provider and
// consumer share one instance.
import { DarkTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';

import { localCredentialStore } from '../src/services/LocalCredentialStore';
import { walletTheme } from '../src/theme';

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: walletTheme.background,
    card: walletTheme.panel,
    text: walletTheme.text,
    border: walletTheme.border,
    primary: walletTheme.accent,
    notification: walletTheme.danger,
  },
};

export default function RootLayout() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);

  useEffect(() => {
    void (async () => {
      const storedNpi = await localCredentialStore.getStoredNpi();
      setHasOnboarded(storedNpi !== null);
      setIsReady(true);
    })();
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: walletTheme.background,
          },
        }}
      >
        {!hasOnboarded && <Stack.Screen name="onboarding" options={{ headerShown: false }} />}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
