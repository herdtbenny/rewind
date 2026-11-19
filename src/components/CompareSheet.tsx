import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Photo } from '../media';
import type { Decision } from '../storage';
import { colors, radius } from '../theme';
import { Button } from './ui';

type Props = {
  items: Photo[];
  onDone: (states: Record<string, Decision>) => void;
  onCancel: () => void;
};

const GAP = 8;

/** Uhrzeit mit Sekunden – Serienfotos liegen oft nur Sekunden auseinander. */
function formatTime(t: number): string {
  const d = new Date(t);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
}

/** Alle restlichen Fotos einer Serie nebeneinander: antippen = behalten/weg umschalten. */
export function CompareSheet({ items, onDone, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [states, setStates] = useState<Record<string, Decision>>(() =>
    Object.fromEntries(items.map((p) => [p.id, 'keep' as Decision])),
  );
  const cols = items.length <= 4 ? 2 : 3;
  const tileW = (width - 32 - GAP * (cols - 1)) / cols;

  const toggle = (id: string) => setStates((s) => ({ ...s, [id]: s[id] === 'keep' ? 'trash' : 'keep' }));
  const onlyThis = (id: string) =>
    setStates(Object.fromEntries(items.map((p) => [p.id, p.id === id ? 'keep' : 'trash'])) as Record<string, Decision>);

  const keepCount = items.filter((p) => states[p.id] === 'keep').length;
  const trashCount = items.length - keepCount;

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(120)}
      style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}
      testID="compare-sheet"
    >
      <View style={styles.header}>
        <Pressable onPress={onCancel} hitSlop={12} testID="compare-cancel">
          <Text style={styles.cancel}>Abbrechen</Text>
        </Pressable>
        <Text style={styles.title}>Serie vergleichen</Text>
        <View style={{ width: 96 }} />
      </View>
      <Text style={styles.lead}>Antippen schaltet um. „Nur dieses“ behält ein Foto und sortiert den Rest aus.</Text>

      <ScrollView contentContainerStyle={styles.grid}>
        {items.map((p) => {
          const keep = states[p.id] === 'keep';
          return (
            <Pressable
              key={p.id}
              testID={`cmp-${p.id}`}
              onPress={() => toggle(p.id)}
              style={[
                styles.tile,
                { width: tileW, height: tileW * 1.33, borderColor: keep ? colors.keep : colors.trash },
              ]}
            >
              <Image
                source={{ uri: p.uri }}
                style={[StyleSheet.absoluteFill, !keep && { opacity: 0.35 }]}
                contentFit="contain"
                recyclingKey={p.id}
              />
              <View style={[styles.badge, { backgroundColor: keep ? colors.keep : colors.trash }]}>
                <Text style={styles.badgeText}>{keep ? 'behalten' : 'weg'}</Text>
              </View>
              <Text style={styles.time}>{formatTime(p.creationTime)}</Text>
              <Pressable onPress={() => onlyThis(p.id)} hitSlop={6} style={styles.only}>
                <Text style={styles.onlyText}>Nur dieses</Text>
              </Pressable>
            </Pressable>
          );
        })}
      </ScrollView>

      <Button
        testID="compare-done"
        label={`Übernehmen · ${keepCount} behalten, ${trashCount} weg`}
        onPress={() => onDone(states)}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: colors.bg, paddingHorizontal: 16, gap: 10, zIndex: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  cancel: { color: colors.accent, fontSize: 16, fontWeight: '600', width: 96 },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  lead: { color: colors.muted, fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingVertical: 8 },
  tile: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#000', borderWidth: 3 },
  badge: { position: 'absolute', top: 8, left: 8, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#0B0B0F', fontSize: 12, fontWeight: '800' },
  time: {
    position: 'absolute',
    top: 8,
    right: 8,
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(11,11,15,0.7)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  only: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(11,11,15,0.8)',
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  onlyText: { color: colors.text, fontSize: 13, fontWeight: '700' },
});
