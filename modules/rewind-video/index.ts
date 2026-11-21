// Natives Modul (nur im Development Build vorhanden, nicht in Expo Go).
import { requireOptionalNativeModule } from 'expo';

export type CategoryKind = 'screens' | 'videos' | 'bursts';

export type NativeAsset = {
  id: string;
  creationTime: number;
  width: number;
  height: number;
  isVideo: boolean;
  duration: number;
  isScreenshot: boolean;
  size?: number;
};

type RewindVideoModule = {
  exportVideo(assetId: string): Promise<string>;
  fetchCategory(kind: CategoryKind): Promise<NativeAsset[]>;
  clearVideoCache(): void;
};

const native = requireOptionalNativeModule<RewindVideoModule>('RewindVideo');

/** Kopiert ein Video der Mediathek in den App-Cache und liefert die abspielbare file://-URL. */
export async function exportVideo(assetId: string): Promise<string | undefined> {
  if (!native) return undefined;
  return native.exportVideo(assetId);
}

/** Einträge einer Kategorie aus den intelligenten Alben (undefined ohne natives Modul). */
export async function fetchCategory(kind: CategoryKind): Promise<NativeAsset[] | undefined> {
  if (!native) return undefined;
  return native.fetchCategory(kind);
}

export function clearVideoCache() {
  native?.clearVideoCache();
}
