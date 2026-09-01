import { Component, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { T } from './Text';

interface Props {
  readonly children: ReactNode;
}
interface State {
  readonly error: Error | null;
}

/**
 * Last line of defence. A render crash anywhere below shows a readable screen
 * with a way out, never a white screen or a red box in production.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    if (__DEV__) console.error('[boundary]', error);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0B0C', padding: 24, justifyContent: 'center' }}>
        <T variant="title" color="#F4F2ED">
          Something broke
        </T>
        <T variant="body" color="#9B9791" style={{ marginTop: 12 }}>
          The screen failed to render. Your saved results are untouched.
        </T>
        <ScrollView style={{ maxHeight: 160, marginTop: 16 }}>
          <T variant="caption" color="#6A6660">
            {error.message}
          </T>
        </ScrollView>
        <Pressable
          onPress={() => this.setState({ error: null })}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          style={{
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 999,
            backgroundColor: '#E8B14C',
            marginTop: 24,
          }}
        >
          <T variant="label" color="#0B0B0C">
            Try again
          </T>
        </Pressable>
      </View>
    );
  }
}
