import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { colors, radius } from '../theme';

/** Muss gedrückt gehalten werden, bis der Balken voll ist – für Aktionen wie Löschen. */
export function HoldButton({
  label,
  holdLabel,
  onComplete,
  loading,
  disabled,
  testID,
  duration = 900,
}: {
  label: string;
  holdLabel: string;
  onComplete: () => void;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  duration?: number;
}) {
  const progress = useSharedValue(0);
  const fill = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));

  const complete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    progress.set(0);
    onComplete();
  };

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityHint="Gedrückt halten"
      disabled={disabled || loading}
      onPressIn={() => {
        Haptics.selectionAsync().catch(() => {});
        progress.set(
          withTiming(1, { duration }, (finished) => {
            if (finished) scheduleOnRN(complete);
          }),
        );
      }}
      onPressOut={() => {
        if (progress.get() < 1) progress.set(withTiming(0, { duration: 160 }));
      }}
      style={[styles.btn, styles.hold, { opacity: disabled ? 0.4 : 1 }]}
    >
      <Animated.View style={[styles.holdFill, fill]} />
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.btnText}>{label}</Text>
          <Text style={styles.holdHint}>{holdLabel}</Text>
        </View>
      )}
    </Pressable>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
};

export function Button({ label, onPress, variant = 'primary', disabled, loading, style, testID }: ButtonProps) {
  const bg = variant === 'danger' ? colors.trash : variant === 'ghost' ? 'transparent' : colors.accent;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        variant === 'ghost' && styles.ghost,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text style={[styles.btnText, variant === 'ghost' && { color: colors.text }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Banner({ children, tone = 'warn' }: { children: ReactNode; tone?: 'warn' | 'info' }) {
  return (
    <View style={[styles.banner, { borderColor: tone === 'warn' ? colors.warn : colors.accent }]}>{children}</View>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 50,
    borderRadius: radius.md,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: { borderWidth: 1, borderColor: colors.border },
  hold: { backgroundColor: '#5A2326', overflow: 'hidden', minHeight: 60 },
  holdFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.trash },
  holdHint: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  banner: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
    backgroundColor: colors.surface,
    gap: 10,
  },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.surface2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
});
