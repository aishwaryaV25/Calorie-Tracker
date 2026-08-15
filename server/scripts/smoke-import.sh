#!/usr/bin/env bash
# Manual smoke test for PDF import: script parse, commit, and the Gemini 503
# when no key is set. Assumes the server is running on $BASE.
set -euo pipefail

BASE="${BASE:-http://localhost:4000/api}"
STAMP="$(date +%s)"
TODAY="$(date +%F)"
WORK="$(mktemp -d)"

pick() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=process.argv[1].split(".").reduce((a,k)=>a?.[k],JSON.parse(s));console.log(v===undefined?"":typeof v==="object"?JSON.stringify(v):v)})' "$1"; }

# A diary PDF the script is expected to read: the most common header names, as
# selectable text rather than a drawn table, so unpdf has something to extract.
node --input-type=module -e '
  import PDFDocument from "pdfkit";
  import fs from "node:fs";
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const out = fs.createWriteStream(process.argv[1]);
  doc.pipe(out);
  doc.fontSize(14).text("Food diary");
  doc.moveDown();
  doc.fontSize(10).text("Type of meal | Name of meal | Calories | Protein | Carbs | Fat");
  doc.text("Breakfast | Porridge with berries | 420 | 12 | 68 | 9");
  doc.text("Lunch | Chicken salad | 610 | 48 | 30 | 32");
  doc.text("Dinner | Paneer curry | 780 | 26 | 95 | 28");
  doc.end();
  await new Promise((resolve) => out.on("finish", resolve));
' "$WORK/diary.pdf"

TOKEN=$(curl -s -X POST "$BASE/auth/signup" -H 'Content-Type: application/json' \
  -d "{\"email\":\"import+$STAMP@example.com\",\"password\":\"supersecret1\",\"displayName\":\"Import Reviewer\"}" | pick token)
AUTH="Authorization: Bearer $TOKEN"

echo "== authentication is required =="
curl -s -o /dev/null -w "  no token -> %{http_code}\n" -F "file=@$WORK/diary.pdf" -F "today=$TODAY" "$BASE/imports/parse"

echo "== script parse of a typical diary =="
curl -s -F "file=@$WORK/diary.pdf" -F "today=$TODAY" -F "mode=script" "$BASE/imports/parse" -H "$AUTH" > "$WORK/preview.json"
echo -n "  rows: "; pick rows.length < "$WORK/preview.json"
echo -n "  first food: "; pick rows.0.foodName < "$WORK/preview.json"
echo -n "  first meal: "; pick rows.0.mealType < "$WORK/preview.json"
echo -n "  method: "; pick method < "$WORK/preview.json"

echo "== commit writes the rows as pdf-sourced entries =="
# Rebuild the commit body from the preview so we exercise the same shape the UI sends.
node -e '
  const preview = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  process.stdout.write(JSON.stringify({ today: process.argv[2], rows: preview.rows }));
' "$WORK/preview.json" "$TODAY" > "$WORK/commit.json"
curl -s -X POST "$BASE/imports/commit" -H "$AUTH" -H 'Content-Type: application/json' \
  --data-binary @"$WORK/commit.json" > "$WORK/saved.json"
echo -n "  imported: "; pick imported < "$WORK/saved.json"
echo -n "  entries now: "; curl -s "$BASE/entries?from=$TODAY&to=$TODAY&pageSize=1" -H "$AUTH" | pick meta.totalItems
echo -n "  source of first: "; curl -s "$BASE/entries?from=$TODAY&to=$TODAY&pageSize=1" -H "$AUTH" | pick data.0.source

echo "== an empty commit is rejected =="
echo -n "  "; curl -s -X POST "$BASE/imports/commit" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"today\":\"$TODAY\",\"rows\":[]}" | pick error.message

echo "== deep analyse without a Gemini key =="
# The script path must still work; Gemini is a separate provider.
echo -n "  status.deepAnalyseAvailable: "
curl -s "$BASE/imports/status" -H "$AUTH" | pick deepAnalyseAvailable
echo -n "  parse mode=gemini: "
curl -s -F "file=@$WORK/diary.pdf" -F "today=$TODAY" -F "mode=gemini" "$BASE/imports/parse" -H "$AUTH" | pick error.message

echo
echo "done"
