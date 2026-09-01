import { ScrollView } from 'react-native';
import { SourceChip } from './SourceChip';
import { allSources, nameOf, sourceById } from '../core/registry';
import type { SourceOutcome } from '../core/types';
import { space, usePalette } from '../theme/tokens';

function detailOf(outcome: SourceOutcome | undefined): { detail: string; active: boolean } {
  if (!outcome) return { detail: '…', active: false };
  switch (outcome.status) {
    case 'ok':
      return { detail: `${outcome.results.length}`, active: outcome.results.length > 0 };
    case 'timeout':
      return { detail: 'slow', active: false };
    case 'error':
      return { detail: 'down', active: false };
    case 'skipped':
      switch (outcome.reason) {
        case 'disabled':
          return { detail: 'off', active: false };
        case 'no-proxy':
          return { detail: 'needs key', active: false };
        case 'resting':
          return { detail: 'resting', active: false };
      }
  }
}

interface Props {
  readonly outcomes: readonly SourceOutcome[];
  readonly onPressSource?: (id: string) => void;
}

/** Per-source truth, always visible. A dead source is information, not a crash. */
export function StatusRail({ outcomes, onPressSource }: Props): React.ReactElement {
  const p = usePalette();
  const byId = new Map(outcomes.map((o) => [String(o.sourceId), o]));
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space.sm, paddingVertical: space.sm }}
      accessibilityLabel="Source status"
    >
      {allSources().map((s) => {
        const { detail, active } = detailOf(byId.get(String(s.id)));
        return (
          <SourceChip
            key={s.id}
            label={nameOf(s.id)}
            accent={sourceById(s.id)?.accent ?? p.accent}
            active={active}
            detail={detail}
            onPress={onPressSource ? () => onPressSource(String(s.id)) : undefined}
          />
        );
      })}
    </ScrollView>
  );
}
