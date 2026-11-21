#!/usr/bin/env bash
# Baut Rewind (Release, JS eingebettet) und installiert es per Kabel auf ein angeschlossenes iPhone.
# Nutzung:  npm run ios:device            -> nimmt das einzige angeschlossene iPhone
#           npm run ios:device -- <UDID>  -> bei mehreren iPhones eins auswählen
# Voraussetzungen: Xcode, Apple-ID in Xcode (Personal Team reicht), iPhone entsperrt + Entwicklermodus an.
set -euo pipefail
cd "$(dirname "$0")/.."

# CocoaPods-Wrapper (siehe README), falls vorhanden
[ -d "$HOME/.cocoapods-gems/wrapper" ] && export PATH="$HOME/.cocoapods-gems/wrapper:$PATH"
export LANG="${LANG:-en_US.UTF-8}"

# 1) Angeschlossene echte iPhones finden
DEVICES_JSON="$(mktemp)"
xcrun devicectl list devices --json-output "$DEVICES_JSON" >/dev/null
UDID="${1:-}"
if [ -z "$UDID" ]; then
  mapfile_out="$(python3 - "$DEVICES_JSON" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1]))
for dev in d.get("result", {}).get("devices", []):
    hw = dev.get("hardwareProperties", {})
    cp = dev.get("connectionProperties", {})
    # nur echte iPhones, die gerade per Kabel angeschlossen sind
    if hw.get("reality") != "simulated" and hw.get("platform") == "iOS" and cp.get("transportType") == "wired":
        print(hw.get("udid"), "|", dev.get("deviceProperties", {}).get("name"), "|", cp.get("pairingState"))
EOF
)"
  COUNT="$(printf '%s\n' "$mapfile_out" | grep -c . || true)"
  if [ "$COUNT" = "0" ]; then
    echo "Kein iPhone gefunden. Per Kabel anschließen, entsperren und 'Diesem Computer vertrauen' bestätigen." >&2
    exit 1
  elif [ "$COUNT" != "1" ]; then
    echo "Mehrere iPhones gefunden – bitte eins angeben: npm run ios:device -- <UDID>" >&2
    printf '%s\n' "$mapfile_out" >&2
    exit 1
  fi
  UDID="$(printf '%s' "$mapfile_out" | cut -d' ' -f1)"
  if printf '%s' "$mapfile_out" | grep -q "| unpaired"; then
    xcrun devicectl manage pair --device "$UDID" >/dev/null 2>&1 || true
    echo "Das iPhone ist noch nicht mit diesem Mac gekoppelt: auf dem iPhone 'Vertrauen' tippen und Code eingeben, dann den Befehl erneut starten." >&2
    exit 1
  fi
fi
rm -f "$DEVICES_JSON"
echo "Ziel-iPhone: $UDID"

# 2) Team-ID aus Xcode lesen (erstes Team; mit REWIND_TEAM=… überschreibbar)
TEAM="${REWIND_TEAM:-$(defaults export com.apple.dt.Xcode - 2>/dev/null | python3 -c '
import plistlib, sys
d = plistlib.loads(sys.stdin.buffer.read())
for teams in d.get("IDEProvisioningTeamByIdentifier", {}).values():
    for t in teams:
        print(t["teamID"]); sys.exit()
')}"
if [ -z "$TEAM" ]; then
  echo "Keine Apple-ID in Xcode gefunden: Xcode → Settings → Accounts → + → Apple Account." >&2
  exit 1
fi
echo "Team: $TEAM"

# 3) iOS-Projekt erzeugen bzw. Pods aktualisieren
if [ ! -d ios ]; then
  npx expo prebuild --platform ios
else
  (cd ios && pod install)
fi

# 4) Bauen und signieren (registriert das Gerät beim ersten Mal automatisch im Team)
(cd ios && xcodebuild -workspace Rewind.xcworkspace -scheme Rewind -configuration Release \
  -destination "id=$UDID" -derivedDataPath build/device \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  DEVELOPMENT_TEAM="$TEAM" CODE_SIGN_STYLE=Automatic build | tail -3)

# 5) Installieren und starten
xcrun devicectl device install app --device "$UDID" ios/build/device/Build/Products/Release-iphoneos/Rewind.app
if ! xcrun devicectl device process launch --device "$UDID" de.local.rewind >/dev/null 2>&1; then
  echo
  echo "Installiert, aber nicht automatisch gestartet. Meist ist das iPhone gesperrt, oder es ist die erste Installation."
  echo "Beim ersten Mal dem Entwickler vertrauen: Einstellungen → Allgemein → VPN & Geräteverwaltung → Apple-ID antippen → Vertrauen."
else
  echo "Installiert und gestartet."
fi
