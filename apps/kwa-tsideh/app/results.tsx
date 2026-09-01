import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSearch } from '../src/hooks/useSearch';
import { useSession } from '../src/state/session';
import { ResultCard } from '../src/ui/ResultCard';
import { SearchField } from '../src/ui/SearchField';
import { StatusRail } from '../src/ui/StatusRail';
import { Banner, Message, Skeleton } from '../src/ui/States';
import { T } from '../src/ui/Text';
import type { SearchResult } from '../src/core/types';
import { space, usePalette } from '../src/theme/tokens';

const DEBOUNCE_MS = 250;

export default function Results(): React.ReactElement {
  const p = usePalette();
  const params = useLocalSearchParams<{ q?: string }>();
  const initial = typeof params.q === 'string' ? params.q : '';

  const [input, setInput] = useState(initial);
  const [committed, setCommitted] = useState(initial);
  const remember = useSession((s) => s.remember);

  // Typing never fires six network calls. One search per settled query.
  useEffect(() => {
    const t = setTimeout(() => setCommitted(input.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);

  const { data, isFetching, isError, error, refetch } = useSearch(committed);

  useEffect(() => {
    if (data?.results) remember(data.results);
  }, [data?.results, remember]);

  const open = useCallback((result: SearchResult) => {
    router.push({ pathname: '/result/[id]', params: { id: result.id } });
  }, []);

  const results = data?.results ?? [];
  const outcomes = data?.outcomes ?? [];
  const failed = outcomes.filter((o) => o.status === 'error' || o.status === 'timeout');

  const header = useMemo(
    () => (
      <View style={{ gap: space.sm, paddingBottom: space.md }}>
        <SearchField value={input} onChangeText={setInput} onSubmit={() => setCommitted(input.trim())} />
        <StatusRail outcomes={outcomes} onPressSource={() => router.push('/settings/sources')} />
        {data?.servedFromCache ? (
          <Banner tone="warn" text="Offline — showing your last saved results." />
        ) : failed.length > 0 ? (
          <Banner
            tone="info"
            text={`${failed.length} source${failed.length === 1 ? '' : 's'} unavailable. Showing everything else.`}
          />
        ) : null}
        {results.length > 0 ? (
          <T variant="caption" color={p.textFaint}>
            {results.length} results · {data?.ms ?? 0}ms
          </T>
        ) : null}
      </View>
    ),
    [input, outcomes, data?.servedFromCache, data?.ms, failed.length, results.length, p.textFaint],
  );

  const body = (): React.ReactElement | null => {
    if (committed.length === 0) {
      return <Message title="Type to search" body="Your query fans out to every enabled source at once." />;
    }
    if (isFetching && results.length === 0) return <Skeleton />;
    if (isError && results.length === 0) {
      return (
        <Message
          title="Search failed"
          body={error?.message ?? 'Something went wrong reaching the sources.'}
          actionLabel="Try again"
          onAction={() => void refetch()}
        />
      );
    }
    if (!isFetching && results.length === 0) {
      return (
        <Message
          title="No results"
          body={`Nothing came back for “${committed}”. Try fewer words, or turn more sources on.`}
          actionLabel="Manage sources"
          onAction={() => router.push('/settings/sources')}
        />
      );
    }
    return null;
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: committed || 'Results' }} />
      <FlatList
        data={results}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <ResultCard result={item} onPress={open} />}
        ListHeaderComponent={header}
        ListEmptyComponent={body()}
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        initialNumToRender={8}
        windowSize={7}
        refreshControl={
          <RefreshControl refreshing={isFetching && results.length > 0} onRefresh={() => void refetch()} tintColor={p.accent} />
        }
      />
    </SafeAreaView>
  );
}
