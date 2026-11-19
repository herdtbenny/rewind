// Lokaler Speicher (nur auf dem Gerät, AsyncStorage):
// - Entscheidungen pro Foto-ID (passen damit in Monats- und Wochenansicht)
// - Statistik (gelöschte Einträge, freigegebener Speicher, aktive Tage)
// - Cache der Dateigrößen
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PeriodMode } from './periods';

export type Decision = 'keep' | 'trash';
export type Decisions = Record<string, Decision>;

export type Stats = {
  deletedCount: number;
  freedBytes: number;
  activeDays: string[]; // "YYYY-MM-DD" (lokal), an denen entschieden wurde
};

const DECISIONS_KEY = 'fotoswipe.decisions.v1';
const MODE_KEY = 'fotoswipe.mode.v1';
const STATS_KEY = 'rewind.stats.v1';
const SIZES_KEY = 'rewind.sizes.v1';

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch((e) => console.warn('storage', key, e));
}

export const loadDecisions = () => readJson<Decisions>(DECISIONS_KEY, {});

let timer: ReturnType<typeof setTimeout> | undefined;
let pending: Decisions | undefined;

/** Gebündelt speichern, damit nicht jeder Swipe die ganze Map schreibt. */
export function saveDecisions(d: Decisions) {
  pending = d;
  if (timer) clearTimeout(timer);
  timer = setTimeout(flushDecisions, 400);
}

export async function flushDecisions() {
  if (timer) clearTimeout(timer);
  timer = undefined;
  if (!pending) return;
  const d = pending;
  pending = undefined;
  try {
    await AsyncStorage.setItem(DECISIONS_KEY, JSON.stringify(d));
  } catch (e) {
    console.warn('saveDecisions', e);
  }
}

export async function loadMode(): Promise<PeriodMode> {
  const m = await AsyncStorage.getItem(MODE_KEY).catch(() => null);
  return m === 'week' ? 'week' : 'month';
}

export function saveMode(m: PeriodMode) {
  AsyncStorage.setItem(MODE_KEY, m).catch(() => {});
}

export const emptyStats: Stats = { deletedCount: 0, freedBytes: 0, activeDays: [] };
export const loadStats = () => readJson<Stats>(STATS_KEY, emptyStats);
export const saveStats = (s: Stats) => writeJson(STATS_KEY, s);

export const loadSizes = () => readJson<Record<string, number>>(SIZES_KEY, {});
export const saveSizes = (s: Record<string, number>) => writeJson(SIZES_KEY, s);

export function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Aufeinanderfolgende Tage mit Aktivität, bis heute (oder gestern, wenn heute noch nichts passiert ist). */
export function streak(activeDays: string[]): number {
  const set = new Set(activeDays);
  const d = new Date();
  if (!set.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(dayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
