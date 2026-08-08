#!/usr/bin/env bash
# PreToolUse (Edit|Write|MultiEdit) — block hand-edits to generated/lock/build files.
set -uo pipefail
PROTECTED='package-lock\.json|yarn\.lock|(^|/)node_modules/|(^|/)build/|(^|/)dist/|(^|/)coverage/|(^|/)\.playwright-mcp/|\.generated\.'
file="$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log((j.tool_input&&(j.tool_input.file_path||j.tool_input.path))||"")}catch(e){console.log("")}})' 2>/dev/null||true)"
if [ -n "$file" ] && printf '%s' "$file" | grep -Eq "$PROTECTED"; then
  echo "Blocked: '$file' is generated/lock/build — don't hand-edit it." >&2; exit 2; fi
exit 0
