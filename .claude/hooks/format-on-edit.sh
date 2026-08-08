#!/usr/bin/env bash
# PostToolUse (Edit|Write|MultiEdit) — prettier the edited file.
# SKIP src/i18n/locales/*: reformatting translation JSONs churns the diff and makes
# en/ar key drift impossible to read in review.
set -uo pipefail
file="$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log((j.tool_input&&(j.tool_input.file_path||j.tool_input.path))||"")}catch(e){console.log("")}})' 2>/dev/null||true)"
case "$file" in
  */src/i18n/locales/*|*/node_modules/*|*/dist/*|*/coverage/*) exit 0 ;;
  *.ts|*.tsx|*.js|*.jsx|*.css) [ -f "$file" ] && npx --no-install prettier --write "$file" >/dev/null 2>&1 && echo "prettier: $file" ;;
esac
exit 0
