import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { T } from './Text';
import { nameOf, sourceById } from '../core/registry';
import type { SearchResult } from '../core/types';
import { radius, space, TOUCH_MIN, usePalette } from '../theme/tokens';

function metricLine(result: SearchResult): string | null {
  if (!result.metrics) return null;
  const parts = Object.entries(result.metrics)
    .filter(([, v]) => v > 0)
    .slice(0, 3)
    .map(([k, v]) => `${v.toLocaleString()} ${k}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function ageLine(publishedAt?: number): string | null {
  if (publishedAt === undefined) return null;
  const days = Math.floor((Date.now() - publishedAt) / 86_400_000);
  if (days < 1) return 'today';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

interface Props {
  readonly result: SearchResult;
  readonly onPress: (result: SearchResult) => void;
}

function Card({ result, onPress }: Props): React.ReactElement {
  const p = usePalette();
  const accent = sourceById(result.sourceId)?.accent ?? p.accent;
  const metrics = metricLine(result);
  const age = ageLine(result.publishedAt);
  const meta = [nameOf(result.sourceId), result.author, age, metrics].filter(Boolean).join('  ·  ');

  return (
    <Pressable
      onPress={() => onPress(result)}
      accessibilityRole="button"
      accessibilityLabel={`${result.title}. From ${nameOf(result.sourceId)}. ${result.snippet}`}
      accessibilityHint="Opens the result detail"
      style={({ pressed }) => ({
        minHeight: TOUCH_MIN,
        flexDirection: 'row',
        backgroundColor: pressed ? p.surfaceRaised : p.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: p.border,
        overflow: 'hidden',
        marginBottom: space.md,
      })}
    >
      <View style={{ width: 3, backgroundColor: accent }} />
      <View style={{ flex: 1, padding: space.lg, gap: space.sm }}>
        <T variant="label" color={p.text} numberOfLines={2}>
          {result.title}
        </T>
        <T variant="body" color={p.textMuted} numberOfLines={3} style={{ fontSize: 14, lineHeight: 20 }}>
          {result.snippet}
        </T>
        <T variant="caption" color={p.textFaint} numberOfLines={1}>
          {meta}
        </T>
      </View>
    </Pressable>
  );
}

export const ResultCard = memo(Card);
