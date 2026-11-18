// Zugriff auf die Fotomediathek über expo-media-library.
// Seit SDK 58 liegt die klassische Async-API (getAssetsAsync, deleteAssetsAsync, …)
// unter "expo-media-library/legacy". Sie liefert pro Aufruf alle Felder, die wir
// brauchen (id, uri, creationTime), und funktioniert auch in Expo Go.
import * as MediaLibrary from 'expo-media-library/legacy';

export type Photo = {
  id: string;
  uri: string;
  creationTime: number;
  width: number;
  height: number;
};

export type Access = 'all' | 'limited' | 'none' | 'undetermined';

function toAccess(p: MediaLibrary.PermissionResponse): Access {
  if (p.status === 'undetermined') return 'undetermined';
  if (!p.granted) return 'none';
  return p.accessPrivileges === 'limited' ? 'limited' : 'all';
}

export async function getAccess(): Promise<{ access: Access; canAskAgain: boolean }> {
  const p = await MediaLibrary.getPermissionsAsync(false, ['photo']);
  return { access: toAccess(p), canAskAgain: p.canAskAgain };
}

/** Lese- UND Schreibzugriff anfragen (writeOnly = false). Schreiben braucht es zum Löschen. */
export async function requestAccess(): Promise<{ access: Access; canAskAgain: boolean }> {
  const p = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
  return { access: toAccess(p), canAskAgain: p.canAskAgain };
}

/** Bei „Ausgewählte Fotos“: System-Dialog zum Ändern der Auswahl öffnen. */
export async function changeLimitedSelection(): Promise<void> {
  await MediaLibrary.presentPermissionsPickerAsync(['photo']);
}

function toPhoto(a: MediaLibrary.Asset): Photo {
  return {
    id: a.id,
    uri: a.uri,
    creationTime: a.creationTime,
    width: a.width,
    height: a.height,
  };
}

const PAGE = 500;

/** Ganze Mediathek (nur Fotos) seitenweise einlesen – für die Übersicht pro Zeitraum. */
export async function scanLibrary(onProgress?: (loaded: number, total: number) => void): Promise<Photo[]> {
  const out: Photo[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await MediaLibrary.getAssetsAsync({
      first: PAGE,
      after,
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    });
    for (const a of page.assets) out.push(toPhoto(a));
    onProgress?.(out.length, page.totalCount);
    if (!page.hasNextPage || page.assets.length === 0) break;
    after = page.endCursor;
  }
  return out;
}

/** Fotos eines Zeitraums frisch aus der Mediathek holen (createdAfter/createdBefore + Paging). */
export async function loadPeriod(start: number, end: number): Promise<Photo[]> {
  const out: Photo[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await MediaLibrary.getAssetsAsync({
      first: PAGE,
      after,
      mediaType: MediaLibrary.MediaType.photo,
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
 * Löscht alle übergebenen Fotos mit EINER System-Bestätigung.
 * iOS: Fotos landen 30 Tage im Album „Zuletzt gelöscht“.
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
