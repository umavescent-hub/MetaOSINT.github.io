import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initDb } from '../src/db/schema';
import { ErrorBoundary } from '../src/ui/ErrorBoundary';
import { useSourcePrefs } from '../src/state/sources';
import { usePalette } from '../src/theme/tokens';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

export default function RootLayout(): React.ReactElement {
  const p = usePalette();
  const hydrate = useSourcePrefs((s) => s.hydrate);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      // A failed database must never block the app: search works without it.
      await initDb();
      await hydrate();
      if (alive) setBooted(true);
    })();
    return () => {
      alive = false;
    };
  }, [hydrate]);

  if (!booted) return <View style={{ flex: 1, backgroundColor: p.bg }} />;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="auto" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: p.bg },
              headerTintColor: p.text,
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: p.bg },
              headerShadowVisible: false,
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="results" options={{ title: 'Results' }} />
            <Stack.Screen name="result/[id]" options={{ title: '' }} />
            <Stack.Screen name="library" options={{ title: 'Library' }} />
            <Stack.Screen name="settings/sources" options={{ title: 'Sources' }} />
          </Stack>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
