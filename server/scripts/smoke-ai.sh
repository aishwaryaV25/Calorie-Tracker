#!/usr/bin/env bash
# Manual smoke test for the AI extraction guards. Assumes the server is running on $BASE.
# Exercises everything that does not require a live API key.
set -euo pipefail

BASE="${BASE:-http://localhost:4000/api}"
STAMP="$(date +%s)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pick() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);console.log(process.argv[1].split(".").reduce((a,k)=>a?.[k],o))})' "$1"; }

# Kept in a variable and never printed.
TOKEN=$(curl -s -X POST "$BASE/auth/signup" -H 'Content-Type: application/json' \
  -d "{\"email\":\"ai+$STAMP@example.com\",\"password\":\"supersecret1\",\"displayName\":\"AI Tester\"}" | pick token)
AUTH="Authorization: Bearer $TOKEN"

echo "== capability probe, so the UI can hide AI features =="
echo -n "  "; curl -s "$BASE/ai/status" -H "$AUTH"; echo

echo "== authentication is required =="
curl -s -o /dev/null -w "  no token -> %{http_code}\n" -X POST "$BASE/ai/extract"

echo "== no file attached =="
echo -n "  "; curl -s -X POST "$BASE/ai/extract" -H "$AUTH" | pick error.message

echo "== wrong file type is rejected before any AI call =="
printf 'not an image' > "$TMP/fake.txt"
echo -n "  "; curl -s -X POST "$BASE/ai/extract" -H "$AUTH" \
  -F "image=@$TMP/fake.txt;type=text/plain" | pick error.message

# The outcome depends on whether a key is configured: without one the route
# returns 503 "not configured", with one the provider rejects a 1x1 image and
# that comes back as a 400. Either way the point is the same — a clear message
# rather than a stack trace.
echo "== a 1x1 image the model cannot read =="
node -e 'require("fs").writeFileSync(process.argv[1],Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==","base64"))' "$TMP/dot.png"
curl -s -o "$TMP/out.json" -w "  status: %{http_code}\n" -X POST "$BASE/ai/extract" -H "$AUTH" \
  -F "image=@$TMP/dot.png;type=image/png"
echo -n "  "; pick error.message < "$TMP/out.json"

echo "done"
