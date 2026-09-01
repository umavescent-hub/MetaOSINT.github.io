import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SearchField } from '../src/ui/SearchField';
import { SourceChip } from '../src/ui/SourceChip';
import { T } from '../src/ui/Text';
import { allSources } from '../src/core/registry';
import { recentSearches, type HistoryEntry } from '../src/db/library';
import { isEnabled, useSourcePrefs } from '../src/state/sources';
import { radius, space, TOUCH_MIN, usePalette } from '../src/theme/tokens';

export default function SearchEntry(): React.ReactElement {
  const p = usePalette();
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<readonly HistoryEntry[]>([]);
  const enabled = useSourcePrefs((s) => s.enabled);
  const sources = allSources();
  const live = sources.filter((s) => isEnabled(enabled, s.id)).length;

  useEffect(() => {
    void recentSearches(8).then(setHistory);
  }, []);

  const submit = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    void Haptics.selectionAsync();
    router.push({ pathname: '/results', params: { q: trimmed } });
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: space.xl, gap: space.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: space.sm, marginTop: space.xxl }}>
          <T variant="display" color={p.text}>
            Kwa Tsideh
          </T>
          <T variant="body" color={p.textMuted}>
            One question. {live} source{live === 1 ? '' : 's'}. One answer feed.
          </T>
        </View>

        <SearchField value={query} onChangeText={setQuery} onSubmit={() => submit(query)} autoFocus />

        <View style={{ gap: space.md }}>
          <T variant="caption" color={p.textFaint}>
            SEARCHING
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {sources.map((s) => (
              <SourceChip
                key={s.id}
                label={s.name}
                accent={s.accent}
                active={isEnabled(enabled, s.id)}
                onPress={() => router.push('/settings/sources')}
              />
            ))}
          </View>
        </View>

        {history.length > 0 ? (
          <View style={{ gap: space.md }}>
            <T variant="caption" color={p.textFaint}>
              RECENT
            </T>
            {history.map((h) => (
              <Pressable
                key={h.id}
                onPress={() => submit(h.query)}
                accessibilityRole="button"
                accessibilityLabel={`Search again for ${h.query}`}
                style={({ pressed }) => ({
                  minHeight: TOUCH_MIN,
                  justifyContent: 'center',
                  paddingHorizontal: space.lg,
                  borderRadius: radius.sm,
                  backgroundColor: pressed ? p.surfaceRaised : 'transparent',
                })}
              >
                <T variant="body" color={p.textMuted} numberOfLines={1}>
                  {h.query}
                </T>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: space.md }}>
          <NavButton label="Library" onPress={() => router.push('/library')} />
          <NavButton label="Sources" onPress={() => router.push('/settings/sources')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function NavButton({
  label,
  onPress,
}: {
  readonly label: string;
  readonly onPress: () => void;
}): React.ReactElement {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: TOUCH_MIN,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: p.border,
        backgroundColor: pressed ? p.surfaceRaised : 'transparent',
      })}
    >
      <T variant="label" color={p.textMuted}>
        {label}
      </T>
    </Pressable>
  );
}
