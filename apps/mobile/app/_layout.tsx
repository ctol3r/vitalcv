import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
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
