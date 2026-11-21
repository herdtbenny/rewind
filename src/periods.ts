// Gruppierung von Fotos nach Monat oder (ISO-)Woche, immer in lokaler Zeit.

export type TimeMode = 'month' | 'week';
export type PeriodMode = TimeMode | 'category';
export type CategoryKey = 'screens' | 'videos' | 'bursts';

export type Period = {
  key: string; // z. B. "m-2026-11", "w-2026-47" oder "c-videos"
  mode: PeriodMode;
  category?: CategoryKey; // nur bei mode "category"

  start: number; // ms, inklusive
  end: number; // ms, exklusive (Beginn des nächsten Zeitraums)
  title: string; // "November 2026" / "KW 47"
  subtitle?: string; // nur Woche: "17.–23. Nov. 2026"
  year: number;
};

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];
const MONTHS_SHORT = [
  'Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni',
  'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.',
];

function startOfWeek(d: Date): Date {
  // Montag 00:00 lokale Zeit
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (r.getDay() + 6) % 7; // Mo=0 … So=6
  r.setDate(r.getDate() - day);
  return r;
}

function isoWeek(d: Date): { week: number; year: number } {
  // ISO-8601: Woche mit dem Donnerstag bestimmt das Jahr
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const firstThursday = new Date(t.getFullYear(), 0, 4);
  const week =
    1 +
    Math.round(
      ((t.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getDay() + 6) % 7)) /
        7,
    );
  return { week, year: t.getFullYear() };
}

export function periodFor(time: number, mode: TimeMode): Period {
  const d = new Date(time);
  if (mode === 'month') {
    const y = d.getFullYear();
    const m = d.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 1);
    return {
      key: `m-${y}-${String(m + 1).padStart(2, '0')}`,
      mode,
      start: start.getTime(),
      end: end.getTime(),
      title: `${MONTHS[m]} ${y}`,
      year: y,
    };
  }
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const last = new Date(end);
  last.setDate(last.getDate() - 1);
  const { week, year } = isoWeek(d);
  const sameMonth = start.getMonth() === last.getMonth();
  const sameYear = start.getFullYear() === last.getFullYear();
  const from = sameMonth
    ? `${start.getDate()}.`
    : `${start.getDate()}. ${MONTHS_SHORT[start.getMonth()]}${sameYear ? '' : ` ${start.getFullYear()}`}`;
  const to = `${last.getDate()}. ${MONTHS_SHORT[last.getMonth()]} ${last.getFullYear()}`;
  return {
    key: `w-${year}-${String(week).padStart(2, '0')}`,
    mode,
    start: start.getTime(),
    end: end.getTime(),
    title: `KW ${week}`,
    subtitle: `${from}–${to}`,
    year, // ISO-Wochenjahr, damit KW 1 unter dem richtigen Jahr steht
  };
}

export function formatDate(time: number): string {
  const d = new Date(time);
  return `${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}, ${String(
    d.getHours(),
  ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const CATEGORIES: { key: CategoryKey; title: string; hint: string }[] = [
  { key: 'screens', title: 'Screenshots & Aufnahmen', hint: 'Älteste zuerst' },
  { key: 'videos', title: 'Videos', hint: 'Größte zuerst' },
  { key: 'bursts', title: 'Serienbilder', hint: 'Jedes Bild einer Serie einzeln' },
];

export function categoryPeriod(key: CategoryKey): Period {
  const c = CATEGORIES.find((x) => x.key === key)!;
  return { key: `c-${key}`, mode: 'category', category: key, start: 0, end: 0, title: c.title, year: 0 };
}
