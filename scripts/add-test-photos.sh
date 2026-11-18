#!/usr/bin/env bash
# Erzeugt datierte Testfotos und spielt sie in den laufenden iOS-Simulator ein.
# Nutzung: npm run test-photos  (oder: bash scripts/add-test-photos.sh 60)
set -euo pipefail
cd "$(dirname "$0")/.."
COUNT="${1:-40}"
python3 scripts/make-test-photos.py "$COUNT" test-photos
xcrun simctl addmedia booted test-photos/*.jpg
echo "Fertig: $COUNT Testfotos im gebooteten Simulator."
