import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NextCard, SwipeCard, type SwipeCardHandle } from '../components/SwipeCard';
import { Button } from '../components/ui';
import { loadPeriod, type Photo } from '../media';
import type { Period } from '../periods';
import type { Decision, Decisions } from '../storage';
import { colors, radius } from '../theme';

type Props = {
  period: Period;
  decisions: Decisions;
  onDecide: (id: string, d: Decision) => void;
  onUndo: (id: string) => void;
  onResetPeriod: (ids: string[]) => void;
  onBack: () => void;
  onReview: (photos: Photo[]) => void;
};

type Step = { photo: Photo; decision: Decision };

export function SwipeScreen({ period, decisions, onDecide, onUndo, onResetPeriod, onBack, onReview }: Props) {
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [queue, setQueue] = useState<Photo[]>([]);
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<Step[]>([]);
  const [enterFrom, setEnterFrom] = useState<Decision | undefined>();
  const card = useRef<SwipeCardHandle>(null);

  useEffect(() => {
    let alive = true;
    loadPeriod(period.start, period.end).then((list) => {
      if (!alive) return;
      setPhotos(list);
      // Nur noch nicht entschiedene Fotos in die Warteschlange → „später weitermachen“.
      setQueue(list.filter((p) => !decisions[p.id]));
      setIndex(0);
    });
    return () => {
      alive = false;
    };
    // Nur beim Öffnen des Zeitraums laden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.key]);

  const current = queue[index];
  const next = queue[index + 1];

  const stats = useMemo(() => {
    let keep = 0;
    let trash = 0;
    for (const p of photos ?? []) {
      if (decisions[p.id] === 'keep') keep++;
      else if (decisions[p.id] === 'trash') trash++;
    }
    return { keep, trash, total: photos?.length ?? 0 };
  }, [photos, decisions]);

  // Button-Taps, die kommen, während die vorige Karte noch rausfliegt, werden gepuffert
  // und auf die nächsten Karten angewendet – so geht bei schnellem Tippen nichts verloren.
  const pending = useRef<Decision[]>([]);

  const press = (d: Decision) => {
    if (!current) return;
    if (!card.current?.swipe(d) && pending.current.length < 5) pending.current.push(d);
  };

  useEffect(() => {
    if (!current || pending.current.length === 0) return;
    const d = pending.current.shift()!;
    const id = requestAnimationFrame(() => {
      if (!card.current?.swipe(d)) pending.current.unshift(d);
    });
    return () => cancelAnimationFrame(id);
  }, [index, current]);

  const handleDecide = (photo: Photo, d: Decision) => {
    onDecide(photo.id, d);
    setHistory((h) => [...h, { photo, decision: d }]);
    setEnterFrom(undefined);
    setIndex((i) => i + 1);
  };

  const undo = () => {
    pending.current = [];
    const last = history[history.length - 1];
    if (!last) return;
    onUndo(last.photo.id);
    setHistory((h) => h.slice(0, -1));
    setEnterFrom(last.decision);
    setIndex((i) => Math.max(0, i - 1));
  };

  const restart = () => {
    if (!photos) return;
    onResetPeriod(photos.map((p) => p.id));
    setQueue(photos);
    setIndex(0);
    setHistory([]);
  };

  const done = photos !== null && !current;
  const trashPhotos = (photos ?? []).filter((p) => decisions[p.id] === 'trash');

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.header}>
        <Pressable testID="back" onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>‹ Übersicht</Text>
        </Pressable>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.title}>{period.title}</Text>
          {photos && (
            <Text style={styles.sub}>
              {stats.keep + stats.trash} / {stats.total} entschieden
            </Text>
          )}
        </View>
      </View>

      <View style={styles.stage}>
        {photos === null ? (
          <ActivityIndicator color={colors.muted} size="large" />
        ) : done ? (
          <View style={styles.done} testID="period-done">
            <Text style={styles.doneTitle}>Zeitraum durch 🎉</Text>
            <Text style={styles.doneText}>
              {stats.keep} behalten · {stats.trash} aussortiert
            </Text>
            <View style={{ gap: 10, alignSelf: 'stretch', marginTop: 16 }}>
              {trashPhotos.length > 0 && (
                <Button
                  testID="review-period"
                  variant="danger"
                  label={`${trashPhotos.length} aussortierte prüfen & löschen`}
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
            />
          </>
        )}
      </View>

      <View style={styles.actions}>
        <RoundButton
          testID="btn-trash"
          label="✕"
          color={colors.trash}
          disabled={!current}
          onPress={() => press('trash')}
        />
        <RoundButton testID="btn-undo" label="↺" small color={colors.muted} disabled={history.length === 0} onPress={undo} />
        <RoundButton
          testID="btn-keep"
          label="♥"
          color={colors.keep}
          disabled={!current}
          onPress={() => press('keep')}
        />
      </View>
      <Text style={styles.hint}>
        ← links: aussortieren · rechts: behalten →
      </Text>
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
  const size = props.small ? 54 : 70;
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
        },
      ]}
    >
      <Text style={{ color: props.color, fontSize: props.small ? 24 : 30, fontWeight: '700' }}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  back: { color: colors.accent, fontSize: 17, fontWeight: '600' },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 13 },
  stage: { flex: 1, marginVertical: 12, alignItems: 'center', justifyContent: 'center' },
  done: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 24,
  },
  doneTitle: { color: colors.text, fontSize: 24, fontWeight: '800' },
  doneText: { color: colors.muted, fontSize: 16, marginTop: 6 },
  actions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 28 },
  round: { borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 10 },
});
