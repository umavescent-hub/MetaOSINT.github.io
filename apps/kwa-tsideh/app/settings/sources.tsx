import { Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { allSources } from '../../src/core/registry';
import { clearCache } from '../../src/db/cache';
import { isEnabled, useSourcePrefs } from '../../src/state/sources';
import { Message } from '../../src/ui/States';
import { T } from '../../src/ui/Text';
import { radius, space, TOUCH_MIN, usePalette } from '../../src/theme/tokens';

export default function Sources(): React.ReactElement {
  const p = usePalette();
  const enabled = useSourcePrefs((s) => s.enabled);
  const weights = useSourcePrefs((s) => s.weights);
  const toggle = useSourcePrefs((s) => s.toggle);
  const setWeight = useSourcePrefs((s) => s.setWeight);
  const reset = useSourcePrefs((s) => s.reset);
  const sources = allSources();

  if (sources.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: p.bg, padding: space.xl }}>
        <Message title="No sources registered" body="Drop a *.source.ts file into src/sources/ and reload." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}>
        <T variant="caption" color={p.textFaint}>
          Every source runs in parallel and fails on its own. Turning one off makes searches faster.
        </T>

        {sources.map((s) => {
          const on = isEnabled(enabled, s.id);
          const weight = weights[s.id] ?? s.weight;
          return (
            <View
              key={s.id}
              style={{
                borderWidth: 1,
                borderColor: p.border,
                borderRadius: radius.md,
                backgroundColor: p.surface,
                padding: space.lg,
                gap: space.md,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.accent }} />
                <View style={{ flex: 1 }}>
                  <T variant="label" color={p.text}>
                    {s.name}
                  </T>
                  <T variant="caption" color={p.textFaint}>
                    {s.kind} · {s.timeoutMs}ms budget{s.requiresProxy ? ' · needs proxy' : ' · no key'}
                  </T>
                </View>
                <Switch
                  value={on}
                  onValueChange={() => toggle(String(s.id))}
                  accessibilityLabel={`${s.name} source`}
                  trackColor={{ true: s.accent, false: p.border }}
                />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <T variant="caption" color={p.textMuted}>
                  Priority
                </T>
                {[0.25, 0.5, 0.75, 1].map((w) => (
                  <Pressable
                    key={w}
                    onPress={() => setWeight(String(s.id), w)}
                    disabled={!on}
                    accessibilityRole="button"
                    accessibilityLabel={`Set ${s.name} priority to ${w * 100} percent`}
                    accessibilityState={{ selected: Math.abs(weight - w) < 0.01 }}
                    hitSlop={10}
                    style={{
                      minWidth: 40,
                      minHeight: 30,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: radius.pill,
                      borderWidth: 1,
                      borderColor: Math.abs(weight - w) < 0.01 ? s.accent : p.border,
                      opacity: on ? 1 : 0.35,
                    }}
                  >
                    <T variant="caption" color={p.textMuted}>
                      {w * 100}
                    </T>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}

        <Pressable
          onPress={() => {
            reset();
            void clearCache();
          }}
          accessibilityRole="button"
          accessibilityLabel="Reset sources and clear cache"
          style={{ minHeight: TOUCH_MIN, justifyContent: 'center', paddingHorizontal: space.lg }}
        >
          <T variant="label" color={p.danger}>
            Reset defaults & clear cache
          </T>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
