import { Pressable, View } from 'react-native';
import { T } from './Text';
import { radius, space, TOUCH_MIN, usePalette } from '../theme/tokens';

interface Props {
  readonly label: string;
  readonly accent: string;
  readonly active: boolean;
  readonly detail?: string;
  readonly onPress?: () => void;
}

export function SourceChip({ label, accent, active, detail, onPress }: Props): React.ReactElement {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${label}${detail ? `, ${detail}` : ''}`}
      accessibilityState={{ selected: active }}
      hitSlop={8}
      style={({ pressed }) => ({
        minHeight: 32,
        justifyContent: 'center',
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? accent : p.border,
        backgroundColor: active ? `${accent}1F` : 'transparent',
        opacity: pressed ? 0.6 : active ? 1 : 0.5,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: active ? accent : p.textFaint,
          }}
        />
        <T variant="caption" color={active ? p.text : p.textMuted}>
          {label}
          {detail ? ` · ${detail}` : ''}
        </T>
      </View>
    </Pressable>
  );
}

export const CHIP_MIN_TOUCH = TOUCH_MIN;
