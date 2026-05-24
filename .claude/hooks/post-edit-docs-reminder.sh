#!/usr/bin/env bash
# Injected after Edit/Write tool use on source files.
# Reads tool_input from stdin (JSON), checks if the edited file is a source file.

input=$(cat)
file_path=$(echo "$input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)

# Only fire for source files, not docs themselves
if echo "$file_path" | grep -qE "(web/src|api/src|shared/src)" && ! echo "$file_path" | grep -q "docs/"; then
  echo ""
  echo "[docs-reminder] Source file edited: $file_path"
  echo "If this change affects any of the following, update the corresponding doc:"
  echo "  - New/changed endpoint      → docs/api.md"
  echo "  - New/changed type or field → docs/data-model.md"
  echo "  - New/changed UI or feature → docs/features.md"
  echo "  - New convention or gotcha  → docs/conventions.md"
  echo "  - New design token or style → docs/design.md"
  echo "Run /update-docs to sync all affected sections."
fi
