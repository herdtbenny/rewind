import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, HoldButton } from '../components/ui';
import { countLabel, formatBytes, formatDuration, type Photo } from '../media';
import { colors, radius } from '../theme';

type Props = {
  title: string;
  photos: Photo[];
  /** Löscht die ausgewählten Fotos wirklich; abgewählte werden als „behalten“ markiert. */
  onDelete: (deleteIds: string[], keepIds: string[]) => Promise<boolean>;
  onBack: () => void;
  /** Bytes pro Foto-ID (für die Speicher-Bilanz). */
  measureSizes: (ids: string[]) => Promise<Record<string, number>>;
};

const COLS = 3;
const GAP = 4;

export function ReviewScreen({ title, photos, onDelete, onBack, measureSizes }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [unselected, setUnselected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const size = (width - 32 - GAP * (COLS - 1)) / COLS;

  const selected = photos.filter((p) => !unselected.has(p.id));
  const [sizes, setSizes] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    let alive = true;
    measureSizes(photos.map((p) => p.id)).then((s) => alive && setSizes(s));
    return () => {
      alive = false;
    };
  }, [photos, measureSizes]);

  const bytes = sizes ? selected.reduce((sum, p) => sum + (sizes[p.id] ?? 0), 0) : null;

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
        Tippe an, was du doch behalten willst. Ausgewählt: {selected.length} von {photos.length}.
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
              {item.isVideo && (
                <View style={styles.videoTag}>
                  <Text style={styles.videoText}>▶ {formatDuration(item.duration)}</Text>
                </View>
              )}
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
          iOS fragt einmal für alle nach. Gelöschtes liegt danach 30 Tage im Album „Zuletzt gelöscht“ der Fotos-App und
          lässt sich dort wiederherstellen.
        </Text>
        {selected.length === 0 ? (
          <Button testID="delete-selected" label="Alle behalten" loading={busy} onPress={run} />
        ) : (
          <HoldButton
            testID="delete-selected"
            label={`${countLabel(selected)} löschen`}
            holdLabel={`Gedrückt halten · ${bytes === null ? 'Größe wird berechnet' : `${formatBytes(bytes)} werden frei`}`}
            loading={busy}
            onComplete={run}
          />
        )}
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
  videoTag: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(11,11,15,0.75)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  videoText: { color: colors.text, fontSize: 11, fontWeight: '700' },
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
