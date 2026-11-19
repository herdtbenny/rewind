# Foto Swipe

Eine Handy-App zum Aufräumen der Fotogalerie, im Tinder-Stil: Du gehst deine Fotos Monat für Monat (oder Woche für Woche) durch, wischst nach links zum Aussortieren und nach rechts zum Behalten. Am Ende löschst du alles Aussortierte gesammelt mit einer einzigen System-Bestätigung.

Expo SDK 58 · React Native 0.88 · TypeScript · rein lokal, kein Server

## Funktionen

- **Zugriff:** Beim ersten Start fragt die App nach Lese- und Schreibzugriff auf die Mediathek. Hast du nur **„Ausgewählte Fotos“** freigegeben, zeigt die App einen Hinweis mit „Auswahl ändern“ (System-Auswahl) und „Alle erlauben“ (Einstellungen). Bei abgelehntem Zugriff führt ein Button direkt in die Einstellungen.
- **Übersicht:** Alle Fotos nach Aufnahmedatum gruppiert, wahlweise nach **Monaten** oder **Kalenderwochen** (ISO-KW, Montag bis Sonntag). Pro Zeitraum siehst du die Zahl der Fotos, wie viele noch offen sind, wie viele aussortiert wurden und einen Fortschrittsbalken.
- **Swipen:** Nach links heißt „weg damit“, nach rechts „behalten“. Alternativ gibt es Buttons ✕ / ♥ und ↺ zum **Rückgängigmachen** (beliebig viele Schritte zurück).
- **Löschen:** Am Ende eines Zeitraums (oder oben in der Übersicht über alle Zeiträume) siehst du ein Raster der aussortierten Fotos. Antippen nimmt ein Foto wieder raus, es wird dann behalten. Danach löschst du alles gesammelt: iOS fragt **einmal** für alle Fotos nach. Gelöschte Fotos liegen danach **30 Tage im Album „Zuletzt gelöscht“** der Fotos-App und lassen sich dort wiederherstellen. Das steht auch so in der App.
- **Fortschritt merken:** Die Entscheidungen werden pro Foto-ID lokal in AsyncStorage gespeichert. Du kannst jederzeit aufhören und später weitermachen. Der Fortschritt gilt in der Monats- und in der Wochenansicht gleichermaßen. Nichts verlässt das Gerät.

## Projektstruktur

```
App.tsx                      Zustand, Navigation (kleine State-Machine), Löschen
src/media.ts                 Mediathek: Berechtigung, Scan, Zeitraum laden, Löschen
src/periods.ts               Gruppierung nach Monat / ISO-Woche, deutsche Labels
src/storage.ts               Fortschritt (AsyncStorage, gebündeltes Speichern)
src/components/SwipeCard.tsx Swipe-Karte (Gesture Handler 3 + Reanimated 4)
src/screens/                 Zugriff, Übersicht, Swipen, Lösch-Übersicht
scripts/add-test-photos.sh   datierte Testfotos erzeugen und in den Simulator laden
```

Technik in Kürze:
- `expo-media-library`: In SDK 58 liegt die klassische Async-API unter `expo-media-library/legacy`. Die App nutzt `getAssetsAsync` mit Paging für die Übersicht und mit `createdAfter`/`createdBefore` für einen Zeitraum, außerdem `deleteAssetsAsync` (eine System-Bestätigung für alle Fotos). Die neue Klassen-API (`Query`, `Asset`) wäre eine spätere Migrationsoption.
- Gesten mit `react-native-gesture-handler` 3 (`usePanGesture`) und Animationen mit `react-native-reanimated` 4 auf dem UI-Thread.
- Berechtigungstexte (deutsch) und `PHPhotoLibraryPreventAutomaticLimitedAccessAlert` kommen über das Config-Plugin in `app.json`.

## Voraussetzungen (Mac)

1. **Xcode** aus dem Mac App Store installieren (kostenlos, ca. 10 GB) und einmal öffnen, damit die Zusatzkomponenten und der iOS-Simulator installiert werden.
2. Xcode als aktives Developer-Verzeichnis setzen (fragt nach deinem Mac-Passwort):
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```
3. Xcode-Lizenz akzeptieren (einmalig): `sudo xcodebuild -license accept`.
4. **CocoaPods** (für den nativen iOS-Build). Normalerweise `brew install cocoapods`. Auf diesem Mac ist Homebrew aber nicht für deinen Benutzer beschreibbar und die System-Ruby (2.6) zu alt. Deshalb liegt CocoaPods 1.17 in `~/.cocoapods-gems` und läuft mit Homebrews mitgelieferter Ruby 3.4, gestartet über das Wrapper-Skript `~/.cocoapods-gems/wrapper/pod`. Vor dem Build einmal in den PATH nehmen:
   ```bash
   export PATH="$HOME/.cocoapods-gems/wrapper:$PATH"
   ```
   (Dauerhaft: dieselbe Zeile in `~/.zshrc`.) Falls Homebrew die Ruby 3.4.5 später aufräumt, CocoaPods mit `brew install cocoapods` neu einrichten, sobald Homebrew wieder beschreibbar ist.
5. Node.js 20+ (vorhanden: Node 24) und dann `npm install` im Projektordner.

## Starten im iOS-Simulator (Development Build, empfohlen)

```bash
cd ~/foto-swipe
npm install
npm run ios
```

`npm run ios` (`expo run:ios`) erzeugt den nativen `ios/`-Ordner (Continuous Native Generation, nicht einchecken), baut die App mit Xcode, installiert sie im Simulator und startet den Metro-Server. Der erste Build dauert einige Minuten.

**Testfotos:** Der Simulator bringt ein paar Beispielfotos mit. Für mehr Monate und Wochen erzeugt dieses Skript 40 Bilder mit unterschiedlichem Aufnahmedatum (EXIF) über die letzten ~5 Monate und lädt sie in den laufenden Simulator:

```bash
npm run test-photos
```

(Das Skript braucht Pillow: `pip3 install pillow`.) In der App danach die Übersicht nach unten ziehen, um neu einzulesen. Meist aktualisiert sie sich auch von selbst.

**Löschen im Simulator testen:** Fotos aussortieren, „prüfen & löschen“ antippen, „Löschen“ im System-Dialog bestätigen, danach in der Fotos-App des Simulators unter „Zuletzt gelöscht“ nachsehen.

### Alternative: Release-Build ohne Dev-Server

Für einen Test ohne laufenden Metro-Server (das JavaScript steckt dann in der App) baut man direkt mit `xcodebuild`. So wurde der Prototyp getestet:

```bash
npx expo prebuild --platform ios
```
```bash
cd ios && xcodebuild -workspace FotoSwipe.xcworkspace -scheme FotoSwipe -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -derivedDataPath build/dd CODE_SIGNING_ALLOWED=NO build
```
```bash
xcrun simctl install booted build/dd/Build/Products/Release-iphonesimulator/FotoSwipe.app && xcrun simctl launch booted de.local.fotoswipe
```

Fotozugriff für einen frischen Test zurücksetzen: `xcrun simctl privacy booted reset photos de.local.fotoswipe`.

### Im Simulator getestet (iOS 26.4, iPhone 17 Pro)

- Berechtigungsdialog mit deutschem Text, „Vollen Zugriff erlauben“ → Übersicht
- Übersicht nach Monaten und Kalenderwochen (inkl. Monatswechsel innerhalb einer KW)
- Swipen links/rechts mit Stempel und Kartenrotation, Buttons ✕/♥, Rückgängig (Karte fliegt zurück)
- Schnelles Tippen auf die Buttons: alle Taps werden nacheinander verarbeitet
- Fortschritt bleibt nach App-Neustart erhalten („5 offen · 3 weg“)
- Lösch-Übersicht: Abwählen markiert ein Foto als „behalten“; iOS zeigt **einen** Bestätigungsdialog für alle Fotos („…will be in Recently Deleted for 30 days“)
- Abbrechen im iOS-Dialog → Hinweis „Nicht gelöscht“, Auswahl bleibt
- Nach dem Löschen: Fotos-App zeigt die richtige Anzahl (46 → 39), abgewählte Fotos sind noch da

### Schneller Test mit Expo Go (ohne Xcode)

Alle verwendeten Module sind in Expo Go enthalten. Ein Schnelltest auf dem eigenen iPhone geht deshalb auch ohne Xcode:

```bash
npm run start:go
```

Dann auf dem iPhone die App **Expo Go** aus dem App Store installieren und den QR-Code mit der Kamera scannen. Mac und iPhone müssen im selben WLAN sein.

Einschränkungen von Expo Go: Die Berechtigung gilt für Expo Go statt für „Foto Swipe“, die Berechtigungstexte sind die von Expo Go, und Expo Go unterstützt nur die jeweils aktuelle SDK-Version. Für den echten Einsatz ist der Development Build gedacht.

## Auf das eigene iPhone installieren

Mit Xcode und einem Kabel geht das ohne kostenpflichtigen Account:

1. iPhone per Kabel anschließen. Auf dem iPhone unter *Einstellungen → Datenschutz & Sicherheit → Entwicklermodus* den Entwicklermodus einschalten (Neustart nötig).
2. In Xcode unter *Settings → Accounts* deine Apple-ID hinzufügen. Das erzeugt ein kostenloses „Personal Team“.
3. ```bash
   npm run ios:device
   ```
   Beim ersten Mal ggf. `ios/FotoSwipe.xcworkspace` in Xcode öffnen, unter *Signing & Capabilities* dein Personal Team wählen und die Bundle-ID bei Bedarf eindeutig machen (z. B. `de.<name>.fotoswipe` in `app.json`).
4. Auf dem iPhone unter *Einstellungen → Allgemein → VPN & Geräteverwaltung* dem Entwicklerzertifikat vertrauen.

Grenzen mit kostenloser Apple-ID: Die App läuft nur **7 Tage** und muss dann neu aus Xcode installiert werden. Es gehen höchstens 3 eigene Apps gleichzeitig.

## Grenzen

- **App Store / TestFlight:** braucht einen kostenpflichtigen **Apple-Developer-Account** (99 €/Jahr). Damit fallen auch die 7 Tage Laufzeit weg. Builds und Uploads können dann über EAS (`npx eas-cli@latest build` / `submit`) laufen.
- **Nicht als Web-App/PWA möglich:** Browser bekommen keinen Zugriff auf die ganze Mediathek und können keine Fotos daraus löschen. Deshalb ist die App nativ.
- **Nur Fotos:** Videos werden aktuell ignoriert (`mediaType: photo`).
- **iCloud-Fotos:** Gelöschte Fotos verschwinden bei aktivierter iCloud-Mediathek auf allen Geräten (ebenfalls 30 Tage unter „Zuletzt gelöscht“). Fotos, die nur in iCloud liegen, lädt die Vorschau ggf. erst herunter.
- **Große Mediatheken:** Die Übersicht liest beim Start alle Foto-Einträge ein (nur Metadaten, seitenweise à 500). Bei mehreren zehntausend Fotos dauert das ein paar Sekunden.
- **Android:** Der Code ist plattformneutral, wurde aber nur für iOS ausgelegt. Google Play erlaubt vollen Mediathek-Zugriff nur für Apps, die ihn wirklich brauchen.

## Entwicklung

```bash
npm run typecheck   # TypeScript prüfen
npm run lint        # ESLint (eslint-config-expo)
npx expo-doctor     # Abhängigkeiten / Konfiguration prüfen
```
