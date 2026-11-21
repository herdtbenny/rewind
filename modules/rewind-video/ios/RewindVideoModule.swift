import ExpoModulesCore
import Photos

/// Auf echten iPhones liegen die Dateien der Mediathek in einem geschützten Bereich:
/// Eine von PhotoKit gelieferte Datei-URL darf ein eigener AVPlayer nicht öffnen
/// („you don't have permission to view it“). Dieses Modul lässt iOS die Videodatei
/// deshalb in den Cache von Rewind kopieren und gibt diese Kopie zurück.
public class RewindVideoModule: Module {
  private static let maxCachedVideos = 6

  public func definition() -> ModuleDefinition {
    Name("RewindVideo")

    /// Kopiert das Video (in der aktuellen Version inkl. Bearbeitungen, sonst das Original)
    /// in Caches/rewind-videos und liefert die file://-URL. Bereits kopierte Videos werden
    /// wiederverwendet. Liegt das Video nur in iCloud, lädt iOS es dabei herunter.
    AsyncFunction("exportVideo") { (assetId: String, promise: Promise) in
      let localId = assetId.hasPrefix("ph://") ? String(assetId.dropFirst(5)) : assetId
      guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [localId], options: nil).firstObject else {
        promise.reject("E_NOT_FOUND", "Video nicht gefunden: \(localId)")
        return
      }
      let resources = PHAssetResource.assetResources(for: asset)
      guard let resource = resources.first(where: { $0.type == .fullSizeVideo })
        ?? resources.first(where: { $0.type == .video })
        ?? resources.first(where: { $0.type == .pairedVideo }) else {
        promise.reject("E_NO_VIDEO", "Keine Videodatei für \(localId)")
        return
      }

      let fm = FileManager.default
      let dir = fm.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("rewind-videos", isDirectory: true)
      try? fm.createDirectory(at: dir, withIntermediateDirectories: true)

      var ext = (resource.originalFilename as NSString).pathExtension.lowercased()
      if ext.isEmpty { ext = "mov" }
      let safeName = localId.replacingOccurrences(of: "/", with: "_")
      let target = dir.appendingPathComponent("\(safeName).\(ext)")

      if fm.fileExists(atPath: target.path) {
        try? fm.setAttributes([.modificationDate: Date()], ofItemAtPath: target.path)
        promise.resolve(target.absoluteString)
        return
      }

      Self.pruneCache(in: dir, keep: Self.maxCachedVideos - 1)

      let temp = dir.appendingPathComponent("\(safeName)-\(UUID().uuidString).part")
      let options = PHAssetResourceRequestOptions()
      options.isNetworkAccessAllowed = true

      PHAssetResourceManager.default().writeData(for: resource, toFile: temp, options: options) { error in
        if let error = error {
          try? fm.removeItem(at: temp)
          promise.reject("E_EXPORT", error.localizedDescription)
          return
        }
        do {
          if fm.fileExists(atPath: target.path) {
            try fm.removeItem(at: temp)
          } else {
            try fm.moveItem(at: temp, to: target)
          }
          promise.resolve(target.absoluteString)
        } catch {
          promise.reject("E_MOVE", error.localizedDescription)
        }
      }
    }

    /// Einträge einer Kategorie aus den intelligenten Alben von iOS.
    /// "screens" = Screenshots + Bildschirmaufnahmen, "videos" = alle Videos (mit Größe),
    /// "bursts" = Serienbilder inkl. aller Einzelbilder (sonst liefert PhotoKit pro Serie nur eins).
    AsyncFunction("fetchCategory") { (kind: String) -> [[String: Any]] in
      let subtypes: [PHAssetCollectionSubtype]
      switch kind {
      case "screens": subtypes = [.smartAlbumScreenshots, .smartAlbumScreenRecordings]
      case "videos": subtypes = [.smartAlbumVideos]
      case "bursts": subtypes = [.smartAlbumBursts]
      default: subtypes = []
      }
      var seen = Set<String>()
      var out: [[String: Any]] = []
      for subtype in subtypes {
        let collections = PHAssetCollection.fetchAssetCollections(with: .smartAlbum, subtype: subtype, options: nil)
        collections.enumerateObjects { collection, _, _ in
          let options = PHFetchOptions()
          options.includeAllBurstAssets = kind == "bursts"
          options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
          PHAsset.fetchAssets(in: collection, options: options).enumerateObjects { asset, _, _ in
            guard seen.insert(asset.localIdentifier).inserted else { return }
            var item: [String: Any] = [
              "id": asset.localIdentifier,
              "creationTime": (asset.creationDate?.timeIntervalSince1970 ?? 0) * 1000,
              "width": asset.pixelWidth,
              "height": asset.pixelHeight,
              "isVideo": asset.mediaType == .video,
              "duration": asset.duration,
              "isScreenshot": asset.mediaSubtypes.contains(.photoScreenshot),
            ]
            if asset.mediaType == .video {
              item["size"] = Self.totalSize(of: asset)
            }
            out.append(item)
          }
        }
      }
      return out
    }

    /// Löscht alle kopierten Videos aus dem Cache.
    Function("clearVideoCache") {
      let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("rewind-videos", isDirectory: true)
      try? FileManager.default.removeItem(at: dir)
    }
  }

  /// Speicherbedarf eines Eintrags: Summe aller Dateien (Original + ggf. Bearbeitung).
  private static func totalSize(of asset: PHAsset) -> Double {
    PHAssetResource.assetResources(for: asset).reduce(0) { sum, resource in
      sum + ((resource.value(forKey: "fileSize") as? NSNumber)?.doubleValue ?? 0)
    }
  }

  /// Behält nur die zuletzt benutzten Kopien, damit der Cache nicht wächst.
  private static func pruneCache(in dir: URL, keep: Int) {
    let fm = FileManager.default
    guard let files = try? fm.contentsOfDirectory(
      at: dir, includingPropertiesForKeys: [.contentModificationDateKey], options: [.skipsHiddenFiles]
    ) else { return }
    let sorted = files.sorted {
      let a = (try? $0.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
      let b = (try? $1.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
      return a > b
    }
    for file in sorted.dropFirst(max(keep, 0)) {
      try? fm.removeItem(at: file)
    }
  }
}
