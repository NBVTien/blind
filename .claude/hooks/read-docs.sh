#!/usr/bin/env bash
# Injected at SessionStart — prints all docs into Claude's context

DOCS_DIR="$(dirname "$0")/../../docs"

echo "=== blind-game docs loaded ==="
echo ""

for f in overview.md features.md data-model.md api.md design.md conventions.md; do
  path="$DOCS_DIR/$f"
  if [ -f "$path" ]; then
    echo "--- docs/$f ---"
    cat "$path"
    echo ""
  fi
done

echo "=== end docs ==="
echo "Before implementing any feature, re-read the relevant doc section above. After implementing, run /update-docs."
