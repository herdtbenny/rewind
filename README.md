# Rewind

Spul deine Galerie Monat für Monat zurück und räum dabei auf: Fotos und Videos im Tinder-Stil durchwischen – links weg, rechts behalten, oben Favorit – und am Ende alles Aussortierte gesammelt löschen. Nur für den privaten Gebrauch gedacht (Development Build aufs eigene iPhone).

Expo SDK 58 · React Native 0.88 · TypeScript · rein lokal, kein Server

## Funktionen

- **Zugriff:** Beim ersten Start fragt die App nach Lese- und Schreibzugriff auf die Mediathek. Hast du nur **„Ausgewählte Fotos“** freigegeben, zeigt sie einen Hinweis mit „Auswahl ändern“ (System-Auswahl) und „Alle erlauben“ (Einstellungen). Bei abgelehntem Zugriff führt ein Button direkt in die Einstellungen.
- **Übersicht:** Fotos und Videos nach Aufnahmedatum, wahlweise nach **Monaten** oder **Kalenderwochen** (ISO-KW). Pro Zeitraum: Anzahl, offen/aussortiert, Videos und Screenshots, Fortschrittsbalken.
- **Statistik-Karte:** Oben in der Übersicht: wie viel Speicher Rewind schon freigegeben hat, wie viele Einträge gelöscht wurden und an wie vielen Tagen in Folge du aufgeräumt hast.
- **Swipen:** links „weg damit“, rechts „behalten“, **nach oben „Favorit“** (setzt das Herz in der Fotos-App, Rückgängig nimmt es wieder weg). Buttons ✕ / ↺ / ★ / ♥; schnelles Tippen wird gepuffert.
- **Screenshots zuerst:** In jedem Zeitraum kommen Screenshots (von iOS als solche markiert) vor allen anderen Fotos.
- **Videos:** laufen stumm in Schleife auf der Karte, mit Längenangabe.
- **Serien vergleichen:** Fotos mit höchstens 10 Sekunden Abstand gelten als Serie. Die Karte zeigt „Serie · 4 Fotos“; mit zwei Fingern zusammenziehen oder „Vergleichen“ antippen zeigt alle nebeneinander. Antippen schaltet behalten/weg um, „Nur dieses“ behält eins und sortiert den Rest aus.
- **Abschluss mit Bilanz:** Am Ende eines Zeitraums: wie viel MB/GB frei werden, was weg kommt und was bleibt.
- **Löschen:** Raster der aussortierten Einträge, Antippen nimmt einen wieder raus. Der Lösch-Button muss **gedrückt gehalten** werden, dann fragt iOS **einmal** für alle nach. Gelöschtes liegt **30 Tage im Album „Zuletzt gelöscht“** der Fotos-App.
- **Fortschritt merken:** Entscheidungen, Statistik und ein Cache der Dateigrößen liegen lokal in AsyncStorage. Nichts verlässt das Gerät.

## Projektstruktur

```
App.tsx                         Zustand, Navigation (kleine State-Machine), Löschen, Statistik
src/media.ts                    Mediathek: Berechtigung, Scan, Zeitraum, Größen, Favorit, Löschen
src/periods.ts                  Gruppierung nach Monat / ISO-Woche, deutsche Labels
src/storage.ts                  Entscheidungen, Statistik, Größen-Cache (AsyncStorage)
src/components/SwipeCard.tsx    Swipe-Karte: 3 Richtungen, Pinch für Serien, Video
src/components/CompareSheet.tsx Serien-Vergleich
src/components/ui.tsx           Buttons inkl. Halten-zum-Löschen
src/screens/                    Zugriff, Übersicht, Swipen, Lösch-Übersicht
scripts/add-test-photos.sh      Testfotos, Serien und Screenshots erzeugen und in den Simulator laden
```

Technik in Kürze:
- `expo-media-library`: In SDK 58 liegt die klassische Async-API unter `expo-media-library/legacy`. Die App nutzt `getAssetsAsync` mit Paging für die Übersicht und mit `createdAfter`/`createdBefore` für einen Zeitraum, außerdem `deleteAssetsAsync` (eine System-Bestätigung für alle Fotos). Die neue Klassen-API (`Query`, `Asset`) wäre eine spätere Migrationsoption.
- Gesten mit `react-native-gesture-handler` 3 (`usePanGesture` + `usePinchGesture`) und Animationen mit `react-native-reanimated` 4 auf dem UI-Thread.
- Videos mit `expo-video`, Dateigrößen über `getAssetInfoAsync` (lokale Datei-URL) und `expo-file-system`. Favoriten über `setAssetFavoriteAsync`.
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
cd ~/myApps/rewind
npm install
npm run ios
```

`npm run ios` (`expo run:ios`) erzeugt den nativen `ios/`-Ordner (Continuous Native Generation, nicht einchecken), baut die App mit Xcode, installiert sie im Simulator und startet den Metro-Server. Der erste Build dauert einige Minuten.

**Testfotos:** Der Simulator bringt ein paar Beispielfotos mit. Für mehr Monate und Wochen erzeugt dieses Skript 40 Bilder mit unterschiedlichem Aufnahmedatum (EXIF) über die letzten ~5 Monate, dazu zwei Serien (Bilder im Abstand von 2 Sekunden) und drei als Screenshot markierte Bilder, und lädt alles in den laufenden Simulator:

```bash
npm run test-photos
```

(Das Skript braucht Pillow: `pip3 install pillow`.) Ein Testvideo lässt sich mit `xcrun simctl addmedia booted <datei.mov>` dazulegen. In der App danach die Übersicht nach unten ziehen, um neu einzulesen. Meist aktualisiert sie sich auch von selbst.

**Löschen im Simulator testen:** Fotos aussortieren, „prüfen & löschen“ antippen, „Löschen“ im System-Dialog bestätigen, danach in der Fotos-App des Simulators unter „Zuletzt gelöscht“ nachsehen.

### Alternative: Release-Build ohne Dev-Server

Für einen Test ohne laufenden Metro-Server (das JavaScript steckt dann in der App) baut man direkt mit `xcodebuild`. So wurde der Prototyp getestet:

```bash
npx expo prebuild --platform ios
```
```bash
cd ios && xcodebuild -workspace Rewind.xcworkspace -scheme Rewind -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -derivedDataPath build/dd CODE_SIGNING_ALLOWED=NO build
```
```bash
xcrun simctl install booted build/dd/Build/Products/Release-iphonesimulator/Rewind.app && xcrun simctl launch booted de.local.rewind
```

Fotozugriff für einen frischen Test zurücksetzen: `xcrun simctl privacy booted reset photos de.local.rewind`.

### Im Simulator getestet (iOS 26.4, iPhone 17 Pro)

- Berechtigungsdialog mit deutschem Text, „Vollen Zugriff erlauben“ → Übersicht
- Übersicht nach Monaten und Kalenderwochen (inkl. Monatswechsel innerhalb einer KW)
- Swipen links/rechts mit Stempel und Kartenrotation, Buttons ✕/♥, Rückgängig (Karte fliegt zurück)
- Schnelles Tippen auf die Buttons: alle Taps werden nacheinander verarbeitet
- Fortschritt bleibt nach App-Neustart erhalten („5 offen · 3 weg“)
- Lösch-Übersicht: Abwählen markiert ein Foto als „behalten“; iOS zeigt **einen** Bestätigungsdialog für alle Fotos („…will be in Recently Deleted for 30 days“)
- Abbrechen im iOS-Dialog → Hinweis „Nicht gelöscht“, Auswahl bleibt
- Nach dem Löschen: Fotos-App zeigt die richtige Anzahl (46 → 39), abgewählte Fotos sind noch da
- Rewind-Version: Favorit per Wischen nach oben, Serien-Erkennung (2 Sekunden Abstand) mit Rauszoomen per Pinch, „Nur dieses“ und Übernehmen, Speicher-Bilanz („112 KB werden frei“), Halten zum Löschen (kurzer Tipp löscht nicht), Statistik-Karte nach dem Löschen, Videos mit Längenangabe

**Im Simulator nicht prüfbar:**
- *Screenshots zuerst:* Der Simulator markiert importierte Bilder nie als Screenshot (auch nicht mit Screenshot-EXIF). Auf dem iPhone setzt iOS die Kennzeichnung bei echten Screenshots selbst; Rewind liest sie über `mediaSubtypes`.
- *Video abspielen (gelöst):* Ab iOS 26 liefert PhotoKit Videos in der „aktuellen“ Version als Komposition, deren Export in `expo-media-library` scheitert („Failed to export the requested video“) – auf dem Simulator wie auf dem iPhone. Rewind holt die Videodatei deshalb über die neue API in der **Originalversion** (`Asset.getUri({ version: ORIGINAL })`). Folge: Bearbeitungen wie ein Zuschnitt werden in der Vorschau nicht mit abgespielt.

### Schneller Test mit Expo Go (ohne Xcode)

Alle verwendeten Module sind in Expo Go enthalten. Ein Schnelltest auf dem eigenen iPhone geht deshalb auch ohne Xcode:

```bash
npm run start:go
```

Dann auf dem iPhone die App **Expo Go** aus dem App Store installieren und den QR-Code mit der Kamera scannen. Mac und iPhone müssen im selben WLAN sein.

Einschränkungen von Expo Go: Die Berechtigung gilt für Expo Go statt für „Rewind“, die Berechtigungstexte sind die von Expo Go, und Expo Go unterstützt nur die jeweils aktuelle SDK-Version. Für den echten Einsatz ist der Development Build gedacht.

## Auf ein iPhone installieren (per Kabel)

Mit Xcode und einer kostenlosen Apple-ID, ohne Developer-Account. Funktioniert für jedes iPhone, auch für ein zweites Gerät (z. B. von Familie): signiert wird immer mit deiner Apple-ID auf diesem Mac.

**Einmalig auf dem Mac**
1. Xcode aus dem App Store installieren, einmal öffnen, iOS-Plattform mitinstallieren. Dann `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` und `sudo xcodebuild -license accept`.
2. In Xcode unter *Xcode → Settings → Accounts → + → Apple Account* deine Apple-ID eintragen. Daraus entsteht dein kostenloses „Personal Team“.
3. CocoaPods einrichten (siehe *Voraussetzungen*).

**Pro iPhone (beim ersten Mal)**
1. iPhone per Kabel anschließen, entsperren und **„Diesem Computer vertrauen“** bestätigen (Code eingeben).
2. Entwicklermodus einschalten: *Einstellungen → Datenschutz & Sicherheit → Entwicklermodus* → an, iPhone startet neu, danach noch einmal bestätigen. Taucht der Punkt nicht auf: in Xcode *Window → Devices and Simulators* öffnen, solange das iPhone angeschlossen ist.

**Installieren**
```bash
npm run ios:device
```
Das Skript `scripts/install-iphone.sh` findet das per Kabel angeschlossene iPhone, liest dein Team aus Xcode, baut die Release-Version (JavaScript ist eingebettet, die App braucht danach keinen Mac), registriert das Gerät beim ersten Mal automatisch in deinem Team, installiert und startet die App. Sind mehrere iPhones angeschlossen: `npm run ios:device -- <UDID>` (die UDIDs listet das Skript auf).

**Beim ersten Start auf dem iPhone:** *Einstellungen → Allgemein → VPN & Geräteverwaltung* → deine Apple-ID antippen → *Vertrauen*. Danach Rewind öffnen und beim Fotozugriff **„Vollzugriff erlauben“** wählen.

**Danach auf dem Gerät prüfen:** Galerie-Übersicht, Swipen, Löschen (landet in „Zuletzt gelöscht“), Videos abspielen und „Screenshots zuerst“ – die letzten beiden ließen sich im Simulator nicht testen.

**Falls Signieren scheitert:** Ist die Bundle-ID `de.local.rewind` für dein Team nicht nutzbar, in `app.json` eine eigene setzen (z. B. `de.<name>.rewind`) und `npx expo prebuild --platform ios --clean` ausführen. Ein anderes Team erzwingen: `REWIND_TEAM=<TEAMID> npm run ios:device`.

**Grenzen der kostenlosen Apple-ID**
- Die App läuft **7 Tage**, danach startet sie nicht mehr. Dann einfach wieder anschließen und `npm run ios:device` – Fortschritt und Statistik bleiben erhalten.
- Apple begrenzt kostenlose Teams stark: höchstens 3 selbst signierte Apps gleichzeitig pro Gerät, nur wenige registrierte Geräte und neue App-IDs pro Woche.
- Ohne Kabel/TestFlight und mit 1 Jahr Laufzeit geht es nur mit dem Apple Developer Program (99 €/Jahr).

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
