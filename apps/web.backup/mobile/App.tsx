import React, { useEffect, useMemo, useState } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { CredentialListScreen } from './src/screens/Credentials';
import { ScanScreen } from './src/screens/ScanScreen';
import { migrateFromAppClip } from './src/services/migration';

const Tab = createBottomTabNavigator();

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [migrationBanner, setMigrationBanner] = useState<string | null>(null);

  useEffect(() => {
    migrateFromAppClip()
      .then((report) => {
        if (report.keysImported || report.credentialsImported) {
          setMigrationBanner(
            `Migrated ${report.keysImported} key(s) • ${report.credentialsImported} credential(s) from App Clip.`,
          );
        } else if (report.warnings.length) {
          setMigrationBanner(report.warnings[0]);
        }
      })
      .catch((error) => setMigrationBanner(error instanceof Error ? error.message : 'Migration failed'));
  }, []);

  const theme = useMemo(() => (isDarkMode ? DarkTheme : DefaultTheme), [isDarkMode]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer theme={theme}>
          <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
          <Tab.Navigator screenOptions={{ headerShown: false }}>
            <Tab.Screen name="Home">
              {(props) => <HomeScreen {...props} migrationBanner={migrationBanner} />}
            </Tab.Screen>
            <Tab.Screen name="Credentials" component={CredentialListScreen} />
            <Tab.Screen name="Scan" component={ScanScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
