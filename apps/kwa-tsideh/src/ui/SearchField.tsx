import { forwardRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { T } from './Text';
import { radius, space, TOUCH_MIN, usePalette } from '../theme/tokens';

interface Props {
  readonly value: string;
  readonly onChangeText: (v: string) => void;
  readonly onSubmit: () => void;
  readonly autoFocus?: boolean;
  readonly placeholder?: string;
}

export const SearchField = forwardRef<TextInput, Props>(function SearchField(
  { value, onChangeText, onSubmit, autoFocus, placeholder = 'Search everything' },
  ref,
) {
  const p = usePalette();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        backgroundColor: p.surface,
        borderColor: p.border,
        borderWidth: 1,
        borderRadius: radius.pill,
        paddingHorizontal: space.lg,
        minHeight: TOUCH_MIN + 6,
      }}
    >
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        autoFocus={autoFocus}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        placeholder={placeholder}
        placeholderTextColor={p.textFaint}
        accessibilityLabel="Search query"
        maxFontSizeMultiplier={1.4}
        style={{ flex: 1, color: p.text, fontSize: 17, paddingVertical: space.md }}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={12}
          style={{ minWidth: 28, minHeight: 28, alignItems: 'center', justifyContent: 'center' }}
        >
          <T variant="label" color={p.textFaint}>
            ✕
          </T>
        </Pressable>
      ) : null}
    </View>
  );
});
