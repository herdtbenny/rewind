// Zugriff auf die Fotomediathek über expo-media-library.
// Seit SDK 58 liegt die klassische Async-API (getAssetsAsync, deleteAssetsAsync, …)
// unter "expo-media-library/legacy". Sie liefert pro Aufruf alle Felder, die wir
// brauchen (id, uri, creationTime, Medientyp, Subtypen), und funktioniert auch in Expo Go.
import { File } from 'expo-file-system';
import { Asset, AssetUriVersion } from 'expo-media-library';
import * as MediaLibrary from 'expo-media-library/legacy';
import { exportVideo } from '../modules/rewind-video';

export type Photo = {
  id: string;
  uri: string; // ph://… – expo-image zeigt damit Fotos und Video-Vorschaubilder
  creationTime: number;
  width: number;
  height: number;
  isVideo: boolean;
  duration: number; // Sekunden, 0 bei Fotos
  isScreenshot: boolean;
};

export type Access = 'all' | 'limited' | 'none' | 'undetermined';

const MEDIA = [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video];

function toAccess(p: MediaLibrary.PermissionResponse): Access {
  if (p.status === 'undetermined') return 'undetermined';
  if (!p.granted) return 'none';
  return p.accessPrivileges === 'limited' ? 'limited' : 'all';
}

export async function getAccess(): Promise<{ access: Access; canAskAgain: boolean }> {
  const p = await MediaLibrary.getPermissionsAsync(false, ['photo', 'video']);
  return { access: toAccess(p), canAskAgain: p.canAskAgain };
}

/** Lese- UND Schreibzugriff anfragen (writeOnly = false). Schreiben braucht es zum Löschen und für Favoriten. */
export async function requestAccess(): Promise<{ access: Access; canAskAgain: boolean }> {
  const p = await MediaLibrary.requestPermissionsAsync(false, ['photo', 'video']);
  return { access: toAccess(p), canAskAgain: p.canAskAgain };
}

/** Bei „Ausgewählte Fotos“: System-Dialog zum Ändern der Auswahl öffnen. */
export async function changeLimitedSelection(): Promise<void> {
  await MediaLibrary.presentPermissionsPickerAsync(['photo', 'video']);
}

function toPhoto(a: MediaLibrary.Asset): Photo {
  return {
    id: a.id,
    uri: a.uri,
    creationTime: a.creationTime,
    width: a.width,
    height: a.height,
    isVideo: a.mediaType === MediaLibrary.MediaType.video,
    duration: a.duration ?? 0,
    isScreenshot: a.mediaSubtypes?.includes('screenshot') ?? false,
  };
}

const PAGE = 500;

/** Ganze Mediathek (Fotos + Videos) seitenweise einlesen – für die Übersicht pro Zeitraum. */
export async function scanLibrary(onProgress?: (loaded: number, total: number) => void): Promise<Photo[]> {
  const out: Photo[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await MediaLibrary.getAssetsAsync({
      first: PAGE,
      after,
      mediaType: MEDIA,
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    });
    for (const a of page.assets) out.push(toPhoto(a));
    onProgress?.(out.length, page.totalCount);
    if (!page.hasNextPage || page.assets.length === 0) break;
    after = page.endCursor;
  }
  return out;
}

/** Medien eines Zeitraums frisch aus der Mediathek holen (createdAfter/createdBefore + Paging). */
export async function loadPeriod(start: number, end: number): Promise<Photo[]> {
  const out: Photo[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await MediaLibrary.getAssetsAsync({
      first: PAGE,
      after,
      mediaType: MEDIA,
      // Beide Grenzen sind auf iOS exklusiv ("creationDate > x" / "< y").
      createdAfter: start - 1,
      createdBefore: end,
      sortBy: [[MediaLibrary.SortBy.creationTime, true]], // älteste zuerst
    });
    for (const a of page.assets) out.push(toPhoto(a));
    if (!page.hasNextPage || page.assets.length === 0) break;
    after = page.endCursor;
  }
  return out;
}

/**
 * Lokale Datei-URL (file://…), z. B. für Dateigröße oder Video-Wiedergabe.
 * Standardmäßig wird nichts aus iCloud nachgeladen; mit allowNetwork darf iOS
 * das Original holen (für Videos nötig, wenn PhotoKit sonst kein Asset liefert).
 */
export async function getLocalUri(id: string, allowNetwork = false): Promise<string | undefined> {
  try {
    const info = await MediaLibrary.getAssetInfoAsync(id, { shouldDownloadFromNetwork: allowNetwork });
    return info.localUri ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Datei-URL des Videos in der Mediathek (ohne Kopie).
 * Ab iOS 26 liefert PhotoKit Videos in der „aktuellen“ Version als Komposition, deren Export
 * in expo-media-library fehlschlägt – deshalb zuerst die Originalversion.
 * Die Größe dieser Datei lässt sich lesen; abspielen darf ein eigener Player sie auf echten
 * iPhones aber nicht (geschützter Bereich der Mediathek), siehe getVideoUri.
 */
async function getLibraryVideoUri(id: string): Promise<string | undefined> {
  for (const version of [AssetUriVersion.ORIGINAL, AssetUriVersion.CURRENT]) {
    try {
      return await new Asset(`ph://${id}`).getUri({ version });
    } catch {
      // nächste Version versuchen
    }
  }
  return (await getLocalUri(id)) ?? (await getLocalUri(id, true));
}

/**
 * Abspielbare Datei-URL für ein Video. Das native Modul lässt iOS das Video in den Cache
 * von Rewind kopieren (wird wiederverwendet, max. 6 Videos). Ohne das Modul (Expo Go)
 * bleibt nur die Mediathek-URL – die spielt nur im Simulator.
 */
export async function getVideoUri(id: string): Promise<string | undefined> {
  try {
    const copied = await exportVideo(id);
    if (copied) return copied;
  } catch {
    // Rückfall unten
  }
  return getLibraryVideoUri(id);
}

/** Dateigröße in Bytes (0, wenn unbekannt, z. B. nur in iCloud). */
export async function getFileSize(id: string, isVideo = false): Promise<number> {
  const uri = isVideo ? await getLibraryVideoUri(id) : await getLocalUri(id);
  if (!uri) return 0;
  try {
    return new File(uri).size || 0;
  } catch {
    return 0;
  }
}

/** Dateigrößen für mehrere Einträge, mit begrenzter Parallelität. */
export async function getFileSizes(
  ids: string[],
  known: Record<string, number> = {},
  videoIds: Set<string> = new Set(),
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const todo = ids.filter((id) => !known[id]); // 0 = unbekannt, erneut messen
  for (const id of ids) if (known[id]) out[id] = known[id];
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
      const id = todo[i++];
      out[id] = await getFileSize(id, videoIds.has(id));
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return out;
}

/** Favorit in der Fotos-App setzen/entfernen. Liefert den vorherigen Zustand. */
export async function setFavorite(id: string, fav: boolean): Promise<boolean | undefined> {
  try {
    const info = await MediaLibrary.getAssetInfoAsync(id, { shouldDownloadFromNetwork: false });
    const before = !!info.isFavorite;
    if (before !== fav) await MediaLibrary.setAssetFavoriteAsync(id, fav);
    return before;
  } catch (e) {
    console.warn('setFavorite', e);
    return undefined;
  }
}

/**
 * Löscht alle übergebenen Einträge mit EINER System-Bestätigung.
 * iOS: Sie landen 30 Tage im Album „Zuletzt gelöscht“.
 * Liefert false, wenn der Nutzer den System-Dialog abbricht.
 */
export async function deletePhotos(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  try {
    return await MediaLibrary.deleteAssetsAsync(ids);
  } catch (e) {
    // Abbrechen im System-Dialog landet hier als Fehler.
    console.warn('deleteAssetsAsync', e);
    return false;
  }
}

export function onLibraryChange(cb: () => void): () => void {
  const sub = MediaLibrary.addListener(() => cb());
  return () => sub.remove();
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toLocaleString('de-DE', { maximumFractionDigits: 1 })} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6).toLocaleString('de-DE')} MB`;
  if (bytes >= 1e3) return `${Math.round(bytes / 1e3)} KB`;
  return `${bytes} B`;
}

export function formatDuration(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** „3 Fotos“, „1 Video“, „2 Fotos & 1 Video“ – für Texte, die beides zählen. */
export function countLabel(items: Pick<Photo, 'isVideo'>[]): string {
  const v = items.filter((p) => p.isVideo).length;
  const f = items.length - v;
  const fs = `${f} ${f === 1 ? 'Foto' : 'Fotos'}`;
  const vs = `${v} ${v === 1 ? 'Video' : 'Videos'}`;
  if (v === 0) return fs;
  if (f === 0) return vs;
  return `${fs} und ${vs}`;
}
