import { useColorScheme } from 'react-native';

/**
 * One palette, two modes. Nothing in the app hardcodes a color.
 * Earth-anchored: charcoal ground, corn-pollen gold, terracotta, turquoise.
 */
export type Palette = {
  readonly [K in
    | 'bg' | 'surface' | 'surfaceRaised' | 'border'
    | 'text' | 'textMuted' | 'textFaint'
    | 'accent' | 'accentInk' | 'danger' | 'ok' | 'skeleton']: string;
};

const dark: Palette = {
  bg: '#0B0B0C',
  surface: '#141416',
  surfaceRaised: '#1C1C20',
  border: '#26262B',
  text: '#F4F2ED',
  textMuted: '#9B9791',
  textFaint: '#6A6660',
  accent: '#E8B14C',
  accentInk: '#0B0B0C',
  danger: '#E06A4E',
  ok: '#5FB49C',
  skeleton: '#1C1C20',
} as const;

const light: Palette = {
  bg: '#FBF9F4',
  surface: '#FFFFFF',
  surfaceRaised: '#F3F0E9',
  border: '#E2DDD2',
  text: '#17161A',
  textMuted: '#5F5A53',
  textFaint: '#8C867D',
  accent: '#B07515',
  accentInk: '#FFFFFF',
  danger: '#B23F22',
  ok: '#2F7F68',
  skeleton: '#EDE9E0',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 36 } as const;
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;

/** Minimum interactive size. Accessibility floor, enforced everywhere. */
export const TOUCH_MIN = 44;

export const type = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const;

export function usePalette(): Palette {
  return useColorScheme() === 'light' ? light : dark;
}
