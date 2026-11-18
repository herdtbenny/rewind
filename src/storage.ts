// Lokaler Fortschritt: welche Fotos schon entschieden sind (nur auf dem Gerät, AsyncStorage).
// Die Entscheidungen hängen an der Foto-ID, nicht am Zeitraum – dadurch passt der
// Fortschritt sowohl in der Monats- als auch in der Wochenansicht.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PeriodMode } from './periods';

export type Decision = 'keep' | 'trash';
export type Decisions = Record<string, Decision>;

const DECISIONS_KEY = 'fotoswipe.decisions.v1';
const MODE_KEY = 'fotoswipe.mode.v1';

export async function loadDecisions(): Promise<Decisions> {
  try {
    const raw = await AsyncStorage.getItem(DECISIONS_KEY);
    return raw ? (JSON.parse(raw) as Decisions) : {};
  } catch {
    return {};
  }
}

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
