import { ActivityIndicator, Pressable, View } from 'react-native';
import { T } from './Text';
import { radius, space, TOUCH_MIN, usePalette } from '../theme/tokens';

export function Skeleton({ count = 5 }: { readonly count?: number }): React.ReactElement {
  const p = usePalette();
  return (
    <View accessibilityLabel="Loading results" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            height: 108,
            borderRadius: radius.md,
            backgroundColor: p.skeleton,
            marginBottom: space.md,
            opacity: 1 - i * 0.12,
          }}
        />
      ))}
    </View>
  );
}

interface MessageProps {
  readonly title: string;
  readonly body: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}

export function Message({ title, body, actionLabel, onAction }: MessageProps): React.ReactElement {
  const p = usePalette();
  return (
    <View style={{ paddingVertical: space.xxl, gap: space.md, alignItems: 'flex-start' }}>
      <T variant="title" color={p.text}>
        {title}
      </T>
      <T variant="body" color={p.textMuted}>
        {body}
      </T>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => ({
            minHeight: TOUCH_MIN,
            justifyContent: 'center',
            paddingHorizontal: space.xl,
            borderRadius: radius.pill,
            backgroundColor: pressed ? p.surfaceRaised : p.accent,
            marginTop: space.sm,
          })}
        >
          <T variant="label" color={p.accentInk}>
            {actionLabel}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Spinner(): React.ReactElement {
  const p = usePalette();
  return (
    <View style={{ padding: space.xl, alignItems: 'center' }}>
      <ActivityIndicator color={p.accent} />
    </View>
  );
}

export function Banner({
  text,
  tone,
}: {
  readonly text: string;
  readonly tone: 'warn' | 'info';
}): React.ReactElement {
  const p = usePalette();
  const color = tone === 'warn' ? p.danger : p.textMuted;
  return (
    <View
      accessibilityRole="alert"
      style={{
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: `${color}55`,
        backgroundColor: `${color}14`,
        marginBottom: space.md,
      }}
    >
      <T variant="caption" color={color}>
        {text}
      </T>
    </View>
  );
}
