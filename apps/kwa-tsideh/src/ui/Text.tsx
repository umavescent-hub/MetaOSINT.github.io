import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { type } from '../theme/tokens';

type Variant = keyof typeof type;

interface Props extends TextProps {
  readonly variant?: Variant;
  readonly color: string;
}

/** All type goes through here: one scale, dynamic-type aware, never inline. */
export function T({ variant = 'body', color, style, ...rest }: Props): React.ReactElement {
  const base = type[variant] as TextStyle;
  return <RNText {...rest} maxFontSizeMultiplier={1.6} style={[base, { color }, style]} />;
}
