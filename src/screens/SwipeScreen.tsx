import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompareSheet } from '../components/CompareSheet';
import { NextCard, SwipeCard, type Swipe, type SwipeCardHandle } from '../components/SwipeCard';
import { Button } from '../components/ui';
import { countLabel, formatBytes, loadPeriod, setFavorite, type Photo } from '../media';
import type { Period } from '../periods';
import type { Decision, Decisions } from '../storage';
import { colors, radius } from '../theme';

type Props = {
  period: Period;
  /** Fertige Liste (Kategorien), sonst wird der Zeitraum aus der Mediathek geladen. */
  items?: Photo[];
  decisions: Decisions;
  onDecide: (id: string, d: Decision) => void;
  onUndo: (id: string) => void;
  onResetPeriod: (ids: string[]) => void;
  onBack: () => void;
  onReview: (photos: Photo[]) => void;
  measureBytes: (ids: string[]) => Promise<number>;
};

type Step = { photo: Photo; swipe: Swipe; favBefore?: boolean };

/** Fotos mit höchstens so viel Abstand gelten als Serie (gleiches Motiv, mehrfach abgedrückt). */
const SERIES_GAP_MS = 10_000;

/** Screenshots zuerst (meist Müll), danach alles andere – jeweils chronologisch. */
function order(list: Photo[]): Photo[] {
  return [...list.filter((p) => p.isScreenshot), ...list.filter((p) => !p.isScreenshot)];
}

/** Für jede Position: Index des letzten Elements der zusammenhängenden Serie. */
function seriesEnds(queue: Photo[]): number[] {
  const ends = new Array<number>(queue.length);
  let start = 0;
  for (let i = 0; i <= queue.length; i++) {
    const breaks =
      i === queue.length ||
      (i > start &&
        (queue[i].isVideo ||
          queue[i - 1].isVideo ||
          queue[i].isScreenshot !== queue[i - 1].isScreenshot ||
          Math.abs(queue[i].creationTime - queue[i - 1].creationTime) > SERIES_GAP_MS));
    if (breaks) {
      for (let k = start; k < i; k++) ends[k] = i - 1;
      start = i;
    }
  }
  return ends;
}

export function SwipeScreen(props: Props) {
  const { period, items, decisions, onDecide, onUndo, onResetPeriod, onBack, onReview, measureBytes } = props;
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [queue, setQueue] = useState<Photo[]>([]);
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<Step[]>([]);
  const [enterFrom, setEnterFrom] = useState<Swipe | undefined>();
  const [comparing, setComparing] = useState(false);
  const [measured, setMeasured] = useState<{ key: string; bytes: number } | null>(null);
  const card = useRef<SwipeCardHandle>(null);

  useEffect(() => {
    let alive = true;
    const load = items ? Promise.resolve(items) : loadPeriod(period.start, period.end);
    load.then((list) => {
      if (!alive) return;
      setPhotos(list);
      // Nur noch nicht entschiedene Einträge in die Warteschlange → „später weitermachen“.
      // Kategorien behalten ihre eigene Reihenfolge (z. B. Videos: größte zuerst).
      const open = list.filter((p) => !decisions[p.id]);
      setQueue(items ? open : order(open));
      setIndex(0);
    });
    return () => {
      alive = false;
    };
    // Nur beim Öffnen des Zeitraums laden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.key]);

  const ends = useMemo(() => seriesEnds(queue), [queue]);
  const current = queue[index];
  const next = queue[index + 1];
  const seriesCount = current ? ends[index] - index + 1 : 0;

  const stats = useMemo(() => {
    let keep = 0;
    let trash = 0;
    for (const p of photos ?? []) {
      if (decisions[p.id] === 'keep') keep++;
      else if (decisions[p.id] === 'trash') trash++;
    }
    return { keep, trash, total: photos?.length ?? 0 };
  }, [photos, decisions]);

  const done = photos !== null && !current;
  const trashPhotos = useMemo(() => (photos ?? []).filter((p) => decisions[p.id] === 'trash'), [photos, decisions]);

  // Speicher-Bilanz erst berechnen, wenn der Zeitraum durch ist
  const trashKey = trashPhotos.map((p) => p.id).join(',');
  useEffect(() => {
    if (!done) return;
    let alive = true;
    measureBytes(trashKey ? trashKey.split(',') : []).then((b) => alive && setMeasured({ key: trashKey, bytes: b }));
    return () => {
      alive = false;
    };
  }, [done, trashKey, measureBytes]);
  const trashBytes = measured?.key === trashKey ? measured.bytes : null;

  // Button-Taps während eine Karte noch rausfliegt werden gepuffert,
  // damit bei schnellem Tippen nichts verloren geht.
  const pending = useRef<Swipe[]>([]);

  const press = (d: Swipe) => {
    if (!current) return;
    if (!card.current?.swipe(d) && pending.current.length < 5) pending.current.push(d);
  };

  useEffect(() => {
    if (!current || comparing || pending.current.length === 0) return;
    const d = pending.current.shift()!;
    const id = requestAnimationFrame(() => {
      if (!card.current?.swipe(d)) pending.current.unshift(d);
    });
    return () => cancelAnimationFrame(id);
  }, [index, current, comparing]);

  const handleDecide = (photo: Photo, d: Swipe) => {
    onDecide(photo.id, d === 'trash' ? 'trash' : 'keep');
    const step: Step = { photo, swipe: d };
    setHistory((h) => [...h, step]);
    setEnterFrom(undefined);
    setIndex((i) => i + 1);
    if (d === 'fav') setFavorite(photo.id, true).then((before) => (step.favBefore = before));
  };

  const undo = () => {
    pending.current = [];
    const last = history[history.length - 1];
    if (!last) return;
    onUndo(last.photo.id);
    if (last.swipe === 'fav' && last.favBefore === false) setFavorite(last.photo.id, false);
    setHistory((h) => h.slice(0, -1));
    setEnterFrom(last.swipe);
    setIndex((i) => Math.max(0, i - 1));
  };

  const applyCompare = (states: Record<string, Decision>) => {
    const items = queue.slice(index, ends[index] + 1);
    for (const p of items) onDecide(p.id, states[p.id]);
    setHistory((h) => [...h, ...items.map((p) => ({ photo: p, swipe: states[p.id] as Swipe }))]);
    setEnterFrom(undefined);
    setIndex(ends[index] + 1);
    setComparing(false);
  };

  const restart = () => {
    if (!photos) return;
    onResetPeriod(photos.map((p) => p.id));
    setQueue(order(photos));
    setIndex(0);
    setHistory([]);
  };

  // Fortschrittsleiste: Anteil entschieden in diesem Zeitraum
  const progress = stats.total ? (stats.keep + stats.trash) / stats.total : 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 10 }]}>
      <View style={styles.header}>
        <Pressable testID="back" onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>‹ Übersicht</Text>
        </Pressable>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.title}>{period.title}</Text>
          {photos && (
            <Text style={styles.sub}>{done ? 'fertig' : `noch ${queue.length - index}`}</Text>
          )}
        </View>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>

      <View style={styles.stage}>
        {photos === null ? (
          <ActivityIndicator color={colors.muted} size="large" />
        ) : done ? (
          <View style={styles.done} testID="period-done">
            <Text style={styles.doneKicker}>{period.title} erledigt</Text>
            {trashPhotos.length > 0 ? (
              <>
                <Text style={styles.doneBig}>{trashBytes === null ? '…' : formatBytes(trashBytes)}</Text>
                <Text style={styles.doneText}>
                  werden frei · {countLabel(trashPhotos)} weg, {stats.keep} bleiben
                </Text>
                <View style={styles.stack}>
                  {trashPhotos.slice(0, 3).map((p, i) => (
                    <Image
                      key={p.id}
                      source={{ uri: p.uri }}
                      contentFit="cover"
                      style={[
                        styles.stackItem,
                        { marginLeft: i ? -16 : 0, transform: [{ rotate: `${[-8, 4, -3][i]}deg` }] },
                      ]}
                    />
                  ))}
                  {trashPhotos.length > 3 && (
                    <View style={[styles.stackItem, styles.stackMore]}>
                      <Text style={styles.stackMoreText}>+{trashPhotos.length - 3}</Text>
                    </View>
                  )}
                </View>
              </>
            ) : (
              <Text style={styles.doneText}>Alles behalten – nichts zu löschen.</Text>
            )}
            <View style={{ gap: 10, alignSelf: 'stretch', marginTop: 8 }}>
              {trashPhotos.length > 0 && (
                <Button
                  testID="review-period"
                  variant="danger"
                  label="Prüfen und löschen"
                  onPress={() => onReview(trashPhotos)}
                />
              )}
              <Button variant="ghost" label="Zur Übersicht" onPress={onBack} />
              {history.length === 0 && stats.total > 0 && (
                <Button variant="ghost" label="Zeitraum neu durchgehen" onPress={restart} />
              )}
            </View>
          </View>
        ) : (
          <>
            {next && <NextCard key={`n-${next.id}`} photo={next} />}
            <SwipeCard
              key={current.id}
              ref={card}
              photo={current}
              enterFrom={enterFrom}
              onDecide={handleDecide}
              seriesCount={seriesCount}
              onCompare={() => setComparing(true)}
            />
          </>
        )}
      </View>

      <View style={styles.actions}>
        <RoundButton testID="btn-trash" label="✕" color={colors.trash} disabled={!current} onPress={() => press('trash')} />
        <RoundButton testID="btn-undo" label="↺" small color={colors.muted} disabled={history.length === 0} onPress={undo} />
        <RoundButton testID="btn-fav" label="★" small color={colors.fav} disabled={!current} onPress={() => press('fav')} />
        <RoundButton testID="btn-keep" label="♥" color={colors.keep} disabled={!current} onPress={() => press('keep')} />
      </View>
      <Text style={styles.hint}>← weg · ↑ Favorit · behalten →</Text>

      {comparing && current && (
        <CompareSheet
          items={queue.slice(index, ends[index] + 1)}
          onDone={applyCompare}
          onCancel={() => setComparing(false)}
        />
      )}
    </View>
  );
}

function RoundButton(props: {
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  small?: boolean;
  testID?: string;
}) {
  const size = props.small ? 52 : 68;
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      onPress={props.onPress}
      disabled={props.disabled}
      style={({ pressed }) => [
        styles.round,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: props.color,
          opacity: props.disabled ? 0.3 : pressed ? 0.7 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
      ]}
    >
      <Text style={{ color: props.color, fontSize: props.small ? 22 : 30, fontWeight: '700' }}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  back: { color: colors.accent, fontSize: 17, fontWeight: '600' },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 13 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.surface2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
  stage: { flex: 1, marginVertical: 14, alignItems: 'center', justifyContent: 'center' },
  done: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 24,
    gap: 8,
  },
  doneKicker: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  doneBig: { color: colors.text, fontSize: 46, fontWeight: '800', letterSpacing: -1 },
  doneText: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  stack: { flexDirection: 'row', marginVertical: 10 },
  stackItem: { width: 56, height: 56, borderRadius: 12, borderWidth: 2, borderColor: colors.surface },
  stackMore: { marginLeft: -16, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  stackMoreText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20 },
  round: { borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 10 },
});
