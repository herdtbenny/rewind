import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  changeLimitedSelection,
  deletePhotos,
  getAccess,
  getFileSizes,
  onLibraryChange,
  requestAccess,
  scanLibrary,
  type Access,
  type Photo,
} from './src/media';
import type { Period, PeriodMode } from './src/periods';
import { PeriodsScreen } from './src/screens/PeriodsScreen';
import { PermissionScreen } from './src/screens/PermissionScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { SwipeScreen } from './src/screens/SwipeScreen';
import {
  dayKey,
  emptyStats,
  flushDecisions,
  loadDecisions,
  loadMode,
  loadSizes,
  loadStats,
  saveDecisions,
  saveMode,
  saveSizes,
  saveStats,
  type Decision,
  type Decisions,
  type Stats,
} from './src/storage';
import { colors } from './src/theme';

type BaseScreen = { name: 'periods' } | { name: 'swipe'; period: Period };
type Screen = BaseScreen | { name: 'review'; title: string; photos: Photo[]; back: BaseScreen };

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Main />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Main() {
  const [access, setAccess] = useState<Access | null>(null);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [decisions, setDecisions] = useState<Decisions>({});
  const [mode, setMode] = useState<PeriodMode>('month');
  const [screen, setScreen] = useState<Screen>({ name: 'periods' });
  const [stats, setStats] = useState<Stats>(emptyStats);
  const sizesRef = useRef<Record<string, number>>({});
  const videoIdsRef = useRef<Set<string>>(new Set());
  const decisionsRef = useRef(decisions);
  decisionsRef.current = decisions;

  const updateStats = useCallback((fn: (s: Stats) => Stats) => {
    setStats((prev) => {
      const next = fn(prev);
      saveStats(next);
      return next;
    });
  }, []);

  /** Dateigrößen (gecacht) für die Speicher-Bilanz. */
  const measureSizes = useCallback(async (ids: string[]) => {
    const res = await getFileSizes(ids, sizesRef.current, videoIdsRef.current);
    sizesRef.current = { ...sizesRef.current, ...res };
    saveSizes(sizesRef.current);
    return res;
  }, []);
  const measureBytes = useCallback(
    async (ids: string[]) => Object.values(await measureSizes(ids)).reduce((a, b) => a + b, 0),
    [measureSizes],
  );

  // Start: gespeicherten Fortschritt + Berechtigungsstatus laden, ggf. direkt nach Zugriff fragen
  useEffect(() => {
    (async () => {
      const [d, m, a, st, sz] = await Promise.all([loadDecisions(), loadMode(), getAccess(), loadStats(), loadSizes()]);
      setDecisions(d);
      setMode(m);
      setStats(st);
      sizesRef.current = sz;
      setCanAskAgain(a.canAskAgain);
      if (a.access === 'undetermined') {
        const r = await requestAccess();
        setAccess(r.access);
        setCanAskAgain(r.canAskAgain);
      } else {
        setAccess(a.access);
      }
    })();
  }, []);

  const scan = useCallback(async () => {
    const list = await scanLibrary((loaded, total) => setProgress({ loaded, total }));
    setPhotos(list);
    setProgress(null);
    videoIdsRef.current = new Set(list.filter((p) => p.isVideo).map((p) => p.id));
    // Entscheidungen zu Fotos entfernen, die es nicht mehr gibt (z. B. in der Fotos-App gelöscht).
    const ids = new Set(list.map((p) => p.id));
    const current = decisionsRef.current;
    const stale = Object.keys(current).filter((id) => !ids.has(id));
    if (stale.length) {
      const next = { ...current };
      for (const id of stale) delete next[id];
      setDecisions(next);
      saveDecisions(next);
    }
  }, []);

  // Mediathek einlesen, sobald Zugriff besteht; bei Änderungen (auch neue Auswahl) neu einlesen
  useEffect(() => {
    if (access !== 'all' && access !== 'limited') return;
    scan();
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = onLibraryChange(() => {
      if (t) clearTimeout(t);
      t = setTimeout(scan, 600);
    });
    return () => {
      off();
      if (t) clearTimeout(t);
    };
  }, [access, scan]);

  // Beim Zurückkehren in die App Berechtigung neu prüfen (z. B. nach den Einstellungen);
  // beim Verlassen Fortschritt sofort speichern.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        getAccess().then((a) => {
          setAccess(a.access);
          setCanAskAgain(a.canAskAgain);
        });
      } else {
        flushDecisions();
      }
    });
    return () => sub.remove();
  }, []);

  const update = (fn: (d: Decisions) => void) => {
    setDecisions((prev) => {
      const next = { ...prev };
      fn(next);
      saveDecisions(next);
      return next;
    });
  };

  const decide = (id: string, d: Decision) => {
    update((x) => void (x[id] = d));
    const today = dayKey();
    if (!stats.activeDays.includes(today)) {
      updateStats((s) => (s.activeDays.includes(today) ? s : { ...s, activeDays: [...s.activeDays, today].slice(-400) }));
    }
  };
  const undo = (id: string) => update((x) => void delete x[id]);
  const resetPeriod = (ids: string[]) => update((x) => ids.forEach((id) => delete x[id]));

  const doDelete = async (deleteIds: string[], keepIds: string[], back: BaseScreen) => {
    if (keepIds.length) update((x) => keepIds.forEach((id) => (x[id] = 'keep')));
    const sizes = await measureSizes(deleteIds).catch(() => ({}) as Record<string, number>);
    const ok = await deletePhotos(deleteIds);
    if (!ok) return false;
    const freed = deleteIds.reduce((sum, id) => sum + (sizes[id] ?? 0), 0);
    updateStats((s) => ({ ...s, deletedCount: s.deletedCount + deleteIds.length, freedBytes: s.freedBytes + freed }));
    update((x) => deleteIds.forEach((id) => delete x[id]));
    const deleted = new Set(deleteIds);
    setPhotos((p) => p?.filter((x) => !deleted.has(x.id)) ?? p);
    await flushDecisions();
    setScreen(back);
    if (deleteIds.length) {
      Alert.alert(
        'Gelöscht',
        `${deleteIds.length} ${deleteIds.length === 1 ? 'Eintrag liegt' : 'Einträge liegen'} jetzt 30 Tage unter „Zuletzt gelöscht“ in der Fotos-App.`,
      );
    }
    return true;
  };

  if (access === null) return <Loading text="" />;
  if (access === 'none' || access === 'undetermined') {
    return (
      <PermissionScreen
        canAskAgain={canAskAgain}
        onRequest={async () => {
          const r = await requestAccess();
          setAccess(r.access);
          setCanAskAgain(r.canAskAgain);
        }}
      />
    );
  }
  if (!photos) {
    return (
      <Loading
        text={progress ? `Mediathek wird gelesen … ${progress.loaded} / ${progress.total}` : 'Mediathek wird gelesen …'}
      />
    );
  }

  if (screen.name === 'swipe') {
    return (
      <SwipeScreen
        period={screen.period}
        decisions={decisions}
        onDecide={decide}
        onUndo={undo}
        onResetPeriod={resetPeriod}
        onBack={() => setScreen({ name: 'periods' })}
        onReview={(list) => setScreen({ name: 'review', title: screen.period.title, photos: list, back: screen })}
        measureBytes={measureBytes}
      />
    );
  }
  if (screen.name === 'review') {
    return (
      <ReviewScreen
        title={screen.title}
        photos={screen.photos}
        onBack={() => setScreen(screen.back)}
        onDelete={(del, keep) => doDelete(del, keep, screen.back)}
        measureSizes={measureSizes}
      />
    );
  }
  return (
    <PeriodsScreen
      photos={photos}
      decisions={decisions}
      stats={stats}
      mode={mode}
      access={access}
      refreshing={refreshing}
      onModeChange={(m) => {
        setMode(m);
        saveMode(m);
      }}
      onOpen={(period) => setScreen({ name: 'swipe', period })}
      onReviewAll={() =>
        setScreen({
          name: 'review',
          title: 'Alle aussortierten',
          photos: photos.filter((p) => decisions[p.id] === 'trash'),
          back: { name: 'periods' },
        })
      }
      onChangeSelection={() => changeLimitedSelection().catch(() => {})}
      onRefresh={async () => {
        setRefreshing(true);
        await scan();
        setRefreshing(false);
      }}
    />
  );
}

function Loading({ text }: { text: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.muted} size="large" />
      {!!text && <Text style={styles.loading}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: 16 },
  loading: { color: colors.muted, fontSize: 15 },
});
