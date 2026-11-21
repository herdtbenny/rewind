import { useMemo } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner, Button, ProgressBar } from '../components/ui';
import { formatBytes, type Access, type Photo } from '../media';
import { periodFor, type Period, type PeriodMode } from '../periods';
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

type Row = { type: 'year'; year: number } | { type: 'period'; stats: PeriodStats };

export function PeriodsScreen(props: Props) {
  const { photos, decisions, mode, access } = props;
  const insets = useSafeAreaInsets();

  const { rows, trashTotal } = useMemo(() => {
    const map = new Map<string, PeriodStats>();
    let trashTotal = 0;
    for (const p of photos) {
      const period = periodFor(p.creationTime, mode);
      let s = map.get(period.key);
      if (!s) map.set(period.key, (s = { period, total: 0, decided: 0, trash: 0, videos: 0, screenshots: 0 }));
      s.total++;
      if (p.isVideo) s.videos++;
      if (p.isScreenshot) s.screenshots++;
      const d = decisions[p.id];
      if (d) s.decided++;
      if (d === 'trash') {
        s.trash++;
        trashTotal++;
      }
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
    return { rows, trashTotal };
  }, [photos, decisions, mode]);

  const header = (
    <View style={{ gap: 16, paddingBottom: 8 }}>
      <Text style={styles.title}>Rewind</Text>
      <StatsCard stats={props.stats} />
      <View style={styles.segment}>
        {(['month', 'week'] as const).map((m) => (
          <Pressable
            key={m}
            testID={`mode-${m}`}
            onPress={() => props.onModeChange(m)}
            style={[styles.segItem, mode === m && styles.segActive]}
          >
            <Text style={[styles.segText, mode === m && { color: colors.text }]}>
              {m === 'month' ? 'Monate' : 'Wochen'}
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
          <Text style={styles.empty}>Keine Fotos gefunden.</Text>
        }
        renderItem={({ item }) => {
          if (item.type === 'year') return <Text style={styles.year}>{item.year}</Text>;
          const { period, total, decided, trash, videos, screenshots } = item.stats;
          const extra = [
            videos ? `${videos} ${videos === 1 ? 'Video' : 'Videos'}` : '',
            screenshots ? `${screenshots} Screenshots` : '',
          ]
            .filter(Boolean)
            .join(' · ');
          const open = total - decided;
          return (
            <Pressable
              testID={`period-${period.key}`}
              onPress={() => props.onOpen(period)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{period.title}</Text>
                  {period.subtitle && <Text style={styles.rowSub}>{period.subtitle}</Text>}
                  {!!extra && <Text style={styles.rowSub}>{extra}</Text>}
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
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function StatsCard({ stats }: { stats: Stats }) {
  const days = streak(stats.activeDays);
  if (stats.deletedCount === 0 && days === 0) {
    return (
      <View style={[styles.stats, { backgroundColor: colors.surface }]}>
        <Text style={[styles.statsBig, { color: colors.text, fontSize: 18 }]}>Spul zurück und räum auf</Text>
        <Text style={[styles.statsSmall, { color: colors.muted }]}>
          Wähl einen Monat, wisch nach links zum Aussortieren, nach rechts zum Behalten, nach oben für Favoriten.
        </Text>
      </View>
    );
  }
  if (stats.deletedCount === 0) {
    return (
      <View style={styles.stats} testID="stats-card">
        <Text style={styles.statsKicker}>Du bist dran</Text>
        <Text style={styles.statsBig}>
          {days} {days === 1 ? 'Tag' : 'Tage'} in Folge
        </Text>
        <Text style={styles.statsSmall}>Noch nichts gelöscht – Aussortiertes löschst du am Ende eines Zeitraums.</Text>
      </View>
    );
  }
  return (
    <View style={styles.stats} testID="stats-card">
      <Text style={styles.statsKicker}>Bisher aufgeräumt</Text>
      <Text style={styles.statsBig}>{formatBytes(stats.freedBytes)} frei</Text>
      <Text style={styles.statsSmall}>
        {stats.deletedCount} gelöscht
        {days > 0 ? ` · ${days} ${days === 1 ? 'Tag' : 'Tage'} in Folge` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { backgroundColor: colors.accent, borderRadius: radius.md, padding: 14, gap: 2 },
  statsKicker: { color: colors.accentInk, fontSize: 13, fontWeight: '600' },
  statsBig: { color: colors.accentInk, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  statsSmall: { color: colors.accentInk, fontSize: 13, lineHeight: 18 },
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
  row: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, gap: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  rowSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  count: { color: colors.text, fontSize: 15, fontWeight: '600' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40 },
});
