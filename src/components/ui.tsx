import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, radius } from '../theme';

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
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  banner: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
    backgroundColor: colors.surface,
    gap: 10,
  },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.surface2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.keep },
});
