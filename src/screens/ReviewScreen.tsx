import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/ui';
import type { Photo } from '../media';
import { colors, radius } from '../theme';

type Props = {
  title: string;
  photos: Photo[];
  /** Löscht die ausgewählten Fotos wirklich; abgewählte werden als „behalten“ markiert. */
  onDelete: (deleteIds: string[], keepIds: string[]) => Promise<boolean>;
  onBack: () => void;
};

const COLS = 3;
const GAP = 4;

export function ReviewScreen({ title, photos, onDelete, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [unselected, setUnselected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const size = (width - 32 - GAP * (COLS - 1)) / COLS;

  const selected = photos.filter((p) => !unselected.has(p.id));

  const toggle = (id: string) =>
    setUnselected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const run = async () => {
    setBusy(true);
    const ok = await onDelete(
      selected.map((p) => p.id),
      photos.filter((p) => unselected.has(p.id)).map((p) => p.id),
    );
    setBusy(false);
    if (!ok) {
      Alert.alert('Nicht gelöscht', 'Das Löschen wurde abgebrochen. Deine Auswahl bleibt erhalten.');
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} testID="review-back">
          <Text style={styles.back}>‹ Zurück</Text>
        </Pressable>
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.lead}>
        Tippe ein Foto an, um es doch zu behalten. Ausgewählt: {selected.length} von {photos.length}.
      </Text>

      <FlatList
        data={photos}
        keyExtractor={(p) => p.id}
        numColumns={COLS}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ gap: GAP, paddingBottom: 16 }}
        renderItem={({ item }) => {
          const on = !unselected.has(item.id);
          return (
            <Pressable testID={`thumb-${item.id}`} onPress={() => toggle(item.id)} style={{ width: size, height: size }}>
              <Image
                source={{ uri: item.uri }}
                style={[styles.thumb, !on && { opacity: 0.35 }]}
                contentFit="cover"
                recyclingKey={item.id}
              />
              <View style={[styles.check, on ? styles.checkOn : styles.checkOff]}>
                <Text style={styles.checkText}>{on ? '✓' : ''}</Text>
              </View>
              {!on && (
                <View style={styles.keepTag}>
                  <Text style={styles.keepText}>behalten</Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Text style={styles.note}>
          iOS fragt einmal nach, dann werden alle ausgewählten Fotos gelöscht. Sie liegen danach noch 30 Tage im Album
          „Zuletzt gelöscht“ in der Fotos-App und lassen sich dort wiederherstellen.
        </Text>
        <Button
          testID="delete-selected"
          variant="danger"
          label={
            selected.length === 0
              ? 'Alle behalten'
              : `${selected.length} ${selected.length === 1 ? 'Foto' : 'Fotos'} löschen`
          }
          disabled={selected.length === 0 && unselected.size === 0}
          loading={busy}
          onPress={run}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  back: { color: colors.accent, fontSize: 17, fontWeight: '600' },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  lead: { color: colors.muted, fontSize: 14, marginBottom: 12 },
  thumb: { width: '100%', height: '100%', borderRadius: 6, backgroundColor: colors.surface },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  checkOn: { backgroundColor: colors.trash, borderColor: colors.trash },
  checkOff: { backgroundColor: 'rgba(0,0,0,0.4)', borderColor: '#fff' },
  checkText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  keepTag: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: colors.keep,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  keepText: { color: '#000', fontSize: 11, fontWeight: '800' },
  footer: {
    gap: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  note: { color: colors.muted, fontSize: 13, lineHeight: 18, borderRadius: radius.sm },
});
