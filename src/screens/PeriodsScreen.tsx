import { useMemo } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner, Button, ProgressBar } from '../components/ui';
import { formatBytes, type Access, type Categories, type Photo } from '../media';
import { CATEGORIES, categoryPeriod, periodFor, type Period, type PeriodMode } from '../periods';
import { streak, type Decisions, type Stats } from '../storage';
import { colors, radius } from '../theme';

export type PeriodStats = {
  period: Period;
  total: number;
  decided: number;
  trash: number;
  videos: number;
  screenshots: number;
};

type Props = {
  photos: Photo[];
  categories: Categories | null;
  trashTotal: number;
  decisions: Decisions;
  stats: Stats;
  mode: PeriodMode;
  access: Access;
  refreshing: boolean;
  onModeChange: (m: PeriodMode) => void;
  onOpen: (p: Period) => void;
  onReviewAll: () => void;
  onChangeSelection: () => void;
  onRefresh: () => void;
};

type Row =
  | { type: 'year'; year: number }
  | { type: 'period'; stats: PeriodStats; hint?: string; bytes?: number };

export function PeriodsScreen(props: Props) {
  const { photos, categories, decisions, mode, access, trashTotal } = props;
  const insets = useSafeAreaInsets();

  const libCounts = useMemo(() => {
    let videos = 0;
    for (const p of photos) if (p.isVideo) videos++;
    return { photos: photos.length - videos, videos };
  }, [photos]);

  const rows = useMemo(() => {
    if (mode === 'category') {
      const rows: Row[] = [];
      for (const c of CATEGORIES) {
        const list = categories?.[c.key] ?? [];
        if (!list.length) continue;
        const s: PeriodStats = { period: categoryPeriod(c.key), total: list.length, decided: 0, trash: 0, videos: 0, screenshots: 0 };
        let bytes = 0;
        for (const p of list) {
          const d = decisions[p.id];
          if (d) s.decided++;
          if (d === 'trash') s.trash++;
          bytes += p.size ?? 0;
        }
        rows.push({ type: 'period', stats: s, hint: c.hint, bytes });
      }
      return rows;
    }
    const map = new Map<string, PeriodStats>();
    for (const p of photos) {
      const period = periodFor(p.creationTime, mode);
      let s = map.get(period.key);
      if (!s) map.set(period.key, (s = { period, total: 0, decided: 0, trash: 0, videos: 0, screenshots: 0 }));
      s.total++;
      if (p.isVideo) s.videos++;
      if (p.isScreenshot) s.screenshots++;
      const d = decisions[p.id];
      if (d) s.decided++;
      if (d === 'trash') s.trash++;
    }
    const sorted = [...map.values()].sort((a, b) => b.period.start - a.period.start);
    const rows: Row[] = [];
    let year: number | undefined;
    for (const s of sorted) {
      if (s.period.year !== year) {
        year = s.period.year;
        rows.push({ type: 'year', year });
      }
      rows.push({ type: 'period', stats: s });
    }
    return rows;
  }, [photos, categories, decisions, mode]);

  const header = (
    <View style={{ gap: 16, paddingBottom: 8 }}>
      <Text style={styles.title}>Rewind</Text>
      <StatsCard stats={props.stats} photoCount={libCounts.photos} videoCount={libCounts.videos} />
      <View style={styles.segment}>
        {(['month', 'week', 'category'] as const).map((m) => (
          <Pressable
            key={m}
            testID={`mode-${m}`}
            onPress={() => props.onModeChange(m)}
            style={[styles.segItem, mode === m && styles.segActive]}
          >
            <Text style={[styles.segText, mode === m && { color: colors.text }]}>
              {m === 'month' ? 'Monate' : m === 'week' ? 'Wochen' : 'Kategorien'}
            </Text>
          </Pressable>
        ))}
      </View>

      {access === 'limited' && (
        <Banner>
          <Text style={styles.bannerText}>
            Du hast nur <Text style={{ fontWeight: '700' }}>ausgewählte Fotos</Text> freigegeben. Die App sieht und
            sortiert nur diese {photos.length} Fotos.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Auswahl ändern" variant="ghost" onPress={props.onChangeSelection} style={{ flex: 1 }} />
            <Button label="Alle erlauben" variant="ghost" onPress={() => Linking.openSettings()} style={{ flex: 1 }} />
          </View>
        </Banner>
      )}

      {trashTotal > 0 && (
        <Pressable testID="review-all" onPress={props.onReviewAll} style={styles.trashBar}>
          <Text style={styles.trashText}>
            {trashTotal} zum Löschen vorgemerkt
          </Text>
          <Text style={styles.trashCta}>Prüfen & löschen ›</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <FlatList
        data={rows}
        keyExtractor={(r) => (r.type === 'year' ? `y${r.year}` : r.stats.period.key)}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 8 }}
        refreshControl={<RefreshControl refreshing={props.refreshing} onRefresh={props.onRefresh} tintColor={colors.muted} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {mode === 'category'
              ? categories
                ? 'Keine Screenshots, Videos oder Serienbilder gefunden.'
                : 'Kategorien werden geladen …'
              : 'Keine Fotos gefunden.'}
          </Text>
        }
        renderItem={({ item }) => {
          if (item.type === 'year') return <Text style={styles.year}>{item.year}</Text>;
          const { period, total, decided, trash } = item.stats;
          const subtitle =
            item.hint !== undefined
              ? [item.hint, item.bytes ? formatBytes(item.bytes) : ''].filter(Boolean).join(' · ')
              : period.subtitle;
          const open = total - decided;
          const finished = total > 0 && open === 0;
          return (
            <Pressable
              testID={`period-${period.key}`}
              onPress={() => props.onOpen(period)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{period.title}</Text>
                  {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.count}>
                    {total} {total === 1 ? 'Eintrag' : 'Einträge'}
                  </Text>
                  <Text style={[styles.rowSub, open === 0 && { color: colors.keep }]}>
                    {open === 0 ? 'fertig' : `${open} offen`}
                    {trash > 0 ? ` · ${trash} weg` : ''}
                  </Text>
                </View>
              </View>
              <ProgressBar value={total ? decided / total : 0} />
              {finished && (
                <View style={styles.doneOverlay} pointerEvents="none" testID={`period-done-${period.key}`}>
                  <View style={styles.doneBadge}>
                    <Text style={styles.doneCheck}>✓</Text>
                  </View>
                  <Text style={styles.doneLabel}>{period.title}</Text>
                  <Text style={styles.doneMeta}>Fertig{trash > 0 ? ` · ${trash} weg` : ''}</Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

/** 12345 → "12.345" */
function formatCount(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function StatsCard({ stats, photoCount, videoCount }: { stats: Stats; photoCount: number; videoCount: number }) {
  const days = streak(stats.activeDays);
  let kicker: string;
  let big: string;
  let small: string;
  if (stats.deletedCount === 0 && days === 0) {
    kicker = 'Spul zurück und räum auf';
    big = '';
    small = 'Wähl einen Monat oder eine Kategorie: links weg, rechts behalten, nach oben Favorit.';
  } else if (stats.deletedCount === 0) {
    kicker = 'Du bist dran';
    big = `${days} ${days === 1 ? 'Tag' : 'Tage'} in Folge`;
    small = 'Noch nichts gelöscht – Aussortiertes löschst du am Ende eines Zeitraums.';
  } else {
    kicker = 'Bisher aufgeräumt';
    big = `${formatBytes(stats.freedBytes)} frei`;
    small = `${stats.deletedCount} gelöscht${days > 0 ? ` · ${days} ${days === 1 ? 'Tag' : 'Tage'} in Folge` : ''}`;
  }
  return (
    <View style={styles.stats} testID="stats-card">
      <View style={styles.libRow}>
        <View style={styles.libCell}>
          <Text style={styles.libNum} testID="lib-photos">{formatCount(photoCount)}</Text>
          <Text style={styles.libLabel}>{photoCount === 1 ? 'Foto' : 'Fotos'}</Text>
        </View>
        <View style={styles.libDivider} />
        <View style={styles.libCell}>
          <Text style={styles.libNum} testID="lib-videos">{formatCount(videoCount)}</Text>
          <Text style={styles.libLabel}>{videoCount === 1 ? 'Video' : 'Videos'}</Text>
        </View>
      </View>
      <View style={styles.statsLine} />
      <Text style={styles.statsKicker}>{kicker}</Text>
      {!!big && <Text style={styles.statsBig}>{big}</Text>}
      <Text style={styles.statsSmall}>{small}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
    gap: 2,
  },
  libRow: { flexDirection: 'row', alignItems: 'center' },
  libCell: { flex: 1 },
  libNum: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  libLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  libDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.border, marginHorizontal: 14 },
  statsLine: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  statsKicker: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  statsBig: { color: colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  statsSmall: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  root: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
  },
  segItem: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segActive: { backgroundColor: colors.surface2 },
  segText: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  bannerText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  trashBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,77,94,0.12)',
    borderColor: colors.trash,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
  },
  trashText: { color: colors.text, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  trashCta: { color: colors.trash, fontSize: 15, fontWeight: '700' },
  year: { color: colors.muted, fontSize: 13, fontWeight: '700', letterSpacing: 1, marginTop: 12 },
  row: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, gap: 12, overflow: 'hidden' },
  doneOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  doneBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneCheck: { color: colors.text, fontSize: 14, fontWeight: '800' },
  doneLabel: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
  doneMeta: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  rowSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  count: { color: colors.text, fontSize: 15, fontWeight: '600' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40 },
});
