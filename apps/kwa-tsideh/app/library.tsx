import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ResultCard } from '../src/ui/ResultCard';
import { Message } from '../src/ui/States';
import { T } from '../src/ui/Text';
import type { SearchResult } from '../src/core/types';
import { clearHistory, listFavorites, recentSearches, type HistoryEntry } from '../src/db/library';
import { useSession } from '../src/state/session';
import { radius, space, TOUCH_MIN, usePalette } from '../src/theme/tokens';

type Tab = 'favorites' | 'history';

export default function Library(): React.ReactElement {
  const p = usePalette();
  const [tab, setTab] = useState<Tab>('favorites');
  const [favorites, setFavorites] = useState<readonly SearchResult[]>([]);
  const [history, setHistory] = useState<readonly HistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const remember = useSession((s) => s.remember);

  const load = useCallback(async (): Promise<void> => {
    const [f, h] = await Promise.all([listFavorites(), recentSearches(50)]);
    setFavorites(f);
    setHistory(h);
    remember(f);
    setLoaded(true);
  }, [remember]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const open = useCallback((result: SearchResult) => {
    router.push({ pathname: '/result/[id]', params: { id: result.id } });
  }, []);

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: p.bg }}>
      <View style={{ flexDirection: 'row', gap: space.sm, padding: space.lg }}>
        <Tabs label="Favorites" active={tab === 'favorites'} onPress={() => setTab('favorites')} />
        <Tabs label="History" active={tab === 'history'} onPress={() => setTab('history')} />
      </View>

      {tab === 'favorites' ? (
        <FlatList
          data={favorites}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <ResultCard result={item} onPress={open} />}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl }}
          ListEmptyComponent={
            loaded ? (
              <Message
                title="Nothing saved yet"
                body="Save a result from its detail screen and it lives here — readable with no connection."
                actionLabel="Start a search"
                onAction={() => router.replace('/')}
              />
            ) : null
          }
        />
      ) : (
        <FlatList
          data={history}
          keyExtractor={(h) => String(h.id)}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/results', params: { q: item.query } })}
              accessibilityRole="button"
              accessibilityLabel={`Search again for ${item.query}`}
              style={({ pressed }) => ({
                minHeight: TOUCH_MIN,
                justifyContent: 'center',
                paddingHorizontal: space.lg,
                paddingVertical: space.md,
                borderRadius: radius.sm,
                backgroundColor: pressed ? p.surfaceRaised : 'transparent',
              })}
            >
              <T variant="body" color={p.text} numberOfLines={1}>
                {item.query}
              </T>
              <T variant="caption" color={p.textFaint}>
                {item.result_count} results · {new Date(item.ts).toLocaleDateString()}
              </T>
            </Pressable>
          )}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl }}
          ListEmptyComponent={
            loaded ? <Message title="No history" body="Searches you run show up here." /> : null
          }
          ListFooterComponent={
            history.length > 0 ? (
              <Pressable
                onPress={() => void clearHistory().then(load)}
                accessibilityRole="button"
                accessibilityLabel="Clear search history"
                style={{ minHeight: TOUCH_MIN, justifyContent: 'center', paddingHorizontal: space.lg }}
              >
                <T variant="label" color={p.danger}>
                  Clear history
                </T>
              </Pressable>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

function Tabs({
  label,
  active,
  onPress,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly onPress: () => void;
}): React.ReactElement {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={{
        flex: 1,
        minHeight: TOUCH_MIN,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.pill,
        backgroundColor: active ? p.surfaceRaised : 'transparent',
        borderWidth: 1,
        borderColor: active ? p.border : 'transparent',
      }}
    >
      <T variant="label" color={active ? p.text : p.textMuted}>
        {label}
      </T>
    </Pressable>
  );
}
