import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { nameOf, sourceById } from '../../src/core/registry';
import type { SearchResult } from '../../src/core/types';
import { findResultById, isFavorite, toggleFavorite } from '../../src/db/library';
import { useSession } from '../../src/state/session';
import { Message, Spinner } from '../../src/ui/States';
import { T } from '../../src/ui/Text';
import { radius, space, TOUCH_MIN, usePalette } from '../../src/theme/tokens';

export default function Detail(): React.ReactElement {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const fromSession = useSession((s) => (typeof id === 'string' ? s.get(id) : undefined));

  const [result, setResult] = useState<SearchResult | null>(fromSession ?? null);
  const [loading, setLoading] = useState(!fromSession);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (typeof id !== 'string') return;
    let alive = true;
    void (async () => {
      if (!fromSession) {
        const found = await findResultById(id);
        if (alive) {
          setResult(found);
          setLoading(false);
        }
      }
      const fav = await isFavorite(id);
      if (alive) setSaved(fav);
    })();
    return () => {
      alive = false;
    };
  }, [id, fromSession]);

  if (loading) return <Spinner />;

  if (!result) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: p.bg, padding: space.xl }}>
        <Message title="Not found" body="This result is no longer in your cache. Run the search again." />
      </SafeAreaView>
    );
  }

  const accent = sourceById(result.sourceId)?.accent ?? p.accent;

  const openExternal = async (): Promise<void> => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await WebBrowser.openBrowserAsync(result.url, { toolbarColor: p.bg, controlsColor: accent });
    } catch {
      // A browser that will not open is not a crash.
    }
  };

  const onToggleFavorite = async (): Promise<void> => {
    void Haptics.selectionAsync();
    setSaved(await toggleFavorite(result));
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: p.bg }}>
      <Stack.Screen options={{ title: nameOf(result.sourceId) }} />
      <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} />
          <T variant="caption" color={p.textMuted}>
            {nameOf(result.sourceId).toUpperCase()}
            {result.author ? ` · ${result.author}` : ''}
          </T>
        </View>

        <T variant="display" color={p.text} style={{ fontSize: 26, lineHeight: 32 }}>
          {result.title}
        </T>

        <T variant="body" color={p.textMuted}>
          {result.snippet}
        </T>

        {result.metrics ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg }}>
            {Object.entries(result.metrics).map(([k, v]) => (
              <View key={k}>
                <T variant="title" color={p.text}>
                  {v.toLocaleString()}
                </T>
                <T variant="caption" color={p.textFaint}>
                  {k}
                </T>
              </View>
            ))}
          </View>
        ) : null}

        <T variant="caption" color={p.textFaint} numberOfLines={2}>
          {result.url}
        </T>

        <View style={{ gap: space.md, marginTop: space.md }}>
          <Action label="Open" primary onPress={() => void openExternal()} />
          <Action label={saved ? 'Saved to library' : 'Save to library'} onPress={() => void onToggleFavorite()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({
  label,
  onPress,
  primary,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly primary?: boolean;
}): React.ReactElement {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        minHeight: TOUCH_MIN + 4,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.pill,
        borderWidth: primary ? 0 : 1,
        borderColor: p.border,
        backgroundColor: primary ? (pressed ? p.textMuted : p.accent) : pressed ? p.surfaceRaised : 'transparent',
      })}
    >
      <T variant="label" color={primary ? p.accentInk : p.text}>
        {label}
      </T>
    </Pressable>
  );
}
