#!/bin/sh
# The full health gate: lint -> build -> unit tests -> live tests.
set -e
cd "$(dirname "$0")/.."
npm run --silent lint
npm run --silent build
npm test --silent
if [ "${SKIP_LIVE:-0}" = "1" ]; then
  echo "LIVE TESTS SKIPPED (SKIP_LIVE=1): YouTube was not contacted."
else
  npm run --silent test:live
fi
