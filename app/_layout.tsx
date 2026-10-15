import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { SamelcoTheme } from '@constants/theme';
import { prepareDatabaseFiles } from '@lib/databaseFiles';

/** Bundled copy of legacy `database.db` (from your PC folder). Copied into the app sandbox on first launch. */
const BUNDLED_SQLITE_ASSET = Platform.OS === 'web' ? undefined : require('../assets/database/database.db');

export default function RootLayout() {
  const theme = SamelcoTheme;
  const [dbReady, setDbReady] = useState(Platform.OS === 'web');

  useEffect(() => {
    let alive = true;
    if (Platform.OS === 'web') return;
    prepareDatabaseFiles()
      .catch(() => {
        // SQLiteProvider can still fall back to the bundled database if maintenance fails.
      })
      .finally(() => {
        if (alive) setDbReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!dbReady) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#B71C1C" />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SQLiteProvider
          databaseName="database.db"
          {...(BUNDLED_SQLITE_ASSET != null
            ? { assetSource: { assetId: BUNDLED_SQLITE_ASSET } }
            : {})}
        >
          <PaperProvider theme={theme}>
            <StatusBar style="light" backgroundColor="#B71C1C" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="splash" />
              <Stack.Screen name="login" />
              <Stack.Screen name="(drawer)" />
            </Stack>
          </PaperProvider>
        </SQLiteProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
