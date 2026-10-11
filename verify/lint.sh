#!/bin/sh
# Syntax-checks every source file and parses every JSON file.
set -e
cd "$(dirname "$0")/.."
for f in $(git ls-files --cached --others --exclude-standard '*.js' '*.mjs'); do
  node --check "$f"
done
for f in $(git ls-files --cached --others --exclude-standard '*.json'); do
  node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$f" || { echo "invalid JSON: $f"; exit 1; }
done
echo "lint: ok"
