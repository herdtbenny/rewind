// Natives Modul (nur im Development Build vorhanden, nicht in Expo Go).
import { requireOptionalNativeModule } from 'expo';

type RewindVideoModule = {
  exportVideo(assetId: string): Promise<string>;
  clearVideoCache(): void;
};

const native = requireOptionalNativeModule<RewindVideoModule>('RewindVideo');

/** Kopiert ein Video der Mediathek in den App-Cache und liefert die abspielbare file://-URL. */
export async function exportVideo(assetId: string): Promise<string | undefined> {
  if (!native) return undefined;
  return native.exportVideo(assetId);
}

export function clearVideoCache() {
  native?.clearVideoCache();
}
