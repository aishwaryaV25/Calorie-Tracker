#!/usr/bin/env bash
# End-to-end coverage of the assignment requirements against a running API.
set -euo pipefail

BASE="${BASE:-http://localhost:4000/api}"
STAMP="$(date +%s)"
TODAY="$(date +%F)"
YEST="$(date -v-1d +%F 2>/dev/null || date -d yesterday +%F)"
WORK="$(mktemp -d)"

pick() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=process.argv[1].split(".").reduce((a,k)=>a?.[k],JSON.parse(s));console.log(v===undefined?"":typeof v==="object"?JSON.stringify(v):v)})' "$1"; }

signup() {
  curl -s -X POST "$BASE/auth/signup" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"supersecret1\",\"displayName\":\"$2\"}"
}

echo "== health =="
curl -s "$BASE/health"; echo

echo "== multi-user: two independent accounts =="
A=$(signup "a+$STAMP@example.com" "Alice" | tee "$WORK/a.json" | pick token)
B=$(signup "b+$STAMP@example.com" "Bob" | tee "$WORK/b.json" | pick token)
AUTH_A="Authorization: Bearer $A"
AUTH_B="Authorization: Bearer $B"
echo -n "  Alice id: "; pick user.id < "$WORK/a.json"
echo -n "  Bob id:   "; pick user.id < "$WORK/b.json"

echo "== goal setting =="
curl -s -X POST "$BASE/goals" -H "$AUTH_A" -H 'Content-Type: application/json' \
  -d "{\"dailyCalories\":2200,\"proteinGrams\":150,\"carbGrams\":230,\"fatGrams\":70,\"targetWeightKg\":68,\"effectiveFrom\":\"$YEST\"}" \
  > "$WORK/goal.json"
echo -n "  saved dailyCalories: "; pick dailyCalories < "$WORK/goal.json"
echo -n "  current for today:   "; curl -s "$BASE/goals/current?date=$TODAY" -H "$AUTH_A" | pick goal.dailyCalories
echo -n "  history pageSize:    "; curl -s "$BASE/goals?page=1&pageSize=5" -H "$AUTH_A" | pick meta.pageSize

echo "== meal entry (all meal types, macros, micros) =="
for meal in breakfast lunch dinner snack; do
  curl -s -o /dev/null -X POST "$BASE/entries" -H "$AUTH_A" -H 'Content-Type: application/json' \
    -d "{\"foodName\":\"$meal item\",\"mealType\":\"$meal\",\"quantity\":1,\"unit\":\"serving\",\"calories\":400,\"proteinGrams\":20,\"carbGrams\":40,\"fatGrams\":12,\"consumedOn\":\"$TODAY\",\"micronutrients\":[{\"nutrient\":\"iron\",\"amount\":2}]}"
done
curl -s -o /dev/null -X POST "$BASE/entries" -H "$AUTH_A" -H 'Content-Type: application/json' \
  -d "{\"foodName\":\"Yesterday oats\",\"mealType\":\"breakfast\",\"quantity\":1,\"unit\":\"bowl\",\"calories\":350,\"consumedOn\":\"$YEST\"}"
echo -n "  Alice today total items: "; curl -s "$BASE/entries?from=$TODAY&to=$TODAY&pageSize=1" -H "$AUTH_A" | pick meta.totalItems

echo "== time-range listing + filters + pagination =="
echo -n "  range yesterday-today: "; curl -s "$BASE/entries?from=$YEST&to=$TODAY&pageSize=2" -H "$AUTH_A" | pick meta.totalItems
echo -n "  breakfast only:        "; curl -s "$BASE/entries?from=$YEST&to=$TODAY&mealType=breakfast&pageSize=20" -H "$AUTH_A" | pick meta.totalItems
echo -n "  page 1 hasNext:        "; curl -s "$BASE/entries?from=$YEST&to=$TODAY&page=1&pageSize=2" -H "$AUTH_A" | pick meta.hasNextPage
echo -n "  page 2 items:          "; curl -s "$BASE/entries?from=$YEST&to=$TODAY&page=2&pageSize=2" -H "$AUTH_A" | pick data.length

echo "== isolation: Bob cannot see Alice =="
echo -n "  Bob entries: "; curl -s "$BASE/entries?from=$YEST&to=$TODAY" -H "$AUTH_B" | pick meta.totalItems
echo -n "  Bob goals:   "; curl -s "$BASE/goals/current?date=$TODAY" -H "$AUTH_B" | pick goal
ALICE_ENTRY=$(curl -s "$BASE/entries?from=$TODAY&to=$TODAY&pageSize=1" -H "$AUTH_A" | pick data.0.id)
echo -n "  Bob fetch Alice entry: "; curl -s "$BASE/entries/$ALICE_ENTRY" -H "$AUTH_B" | pick error.code

echo "== nutrition reports =="
echo -n "  daily days:     "; curl -s "$BASE/reports/daily?from=$YEST&to=$TODAY&pageSize=10" -H "$AUTH_A" | pick meta.totalItems
echo -n "  weekly weeks:   "; curl -s "$BASE/reports/weekly?from=$YEST&to=$TODAY&pageSize=10" -H "$AUTH_A" | pick meta.totalItems
echo -n "  macros protein: "; curl -s "$BASE/reports/macros?from=$YEST&to=$TODAY" -H "$AUTH_A" | pick grams.proteinGrams
echo -n "  micros count:   "; curl -s "$BASE/reports/micronutrients?from=$YEST&to=$TODAY" -H "$AUTH_A" | pick meta.totalItems
echo -n "  vs goal %:      "; curl -s "$BASE/reports/goal-comparison?from=$YEST&to=$TODAY" -H "$AUTH_A" | pick adherence.calories

echo "== downloadable PDF report =="
curl -s -o "$WORK/report.pdf" -D "$WORK/report.headers" "$BASE/reports/pdf?from=$YEST&to=$TODAY" -H "$AUTH_A"
node -e '
  const fs = require("fs");
  const bytes = fs.readFileSync(process.argv[1]);
  const text = bytes.toString("latin1");
  console.log(`  ${bytes.length} bytes, header ${text.slice(0,8)}, eof ${text.trimEnd().endsWith("%%EOF")}`);
' "$WORK/report.pdf"
echo -n "  content-type: "; grep -i content-type "$WORK/report.headers" | tr -d '\r' | head -1

echo "== bulk PDF import (script) =="
node --input-type=module -e '
  import PDFDocument from "pdfkit";
  import fs from "node:fs";
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const out = fs.createWriteStream(process.argv[1]);
  doc.pipe(out);
  doc.fontSize(12).text("Type of meal | Name of meal | Calories | Protein | Carbs | Fat");
  doc.text("Breakfast | Imported khichdi | 380 | 14 | 58 | 8");
  doc.text("Snack | Imported banana | 105 | 1 | 27 | 0");
  doc.end();
  await new Promise((resolve) => out.on("finish", resolve));
' "$WORK/diary.pdf"
curl -s -F "file=@$WORK/diary.pdf" -F "today=$TODAY" -F "mode=script" "$BASE/imports/parse" -H "$AUTH_B" > "$WORK/preview.json"
echo -n "  parse method: "; pick method < "$WORK/preview.json"
echo -n "  parse rows:   "; pick rows.length < "$WORK/preview.json"
node -e '
  const preview = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  process.stdout.write(JSON.stringify({ today: process.argv[2], rows: preview.rows }));
' "$WORK/preview.json" "$TODAY" > "$WORK/commit.json"
echo -n "  imported:     "; curl -s -X POST "$BASE/imports/commit" -H "$AUTH_B" -H 'Content-Type: application/json' --data-binary @"$WORK/commit.json" | pick imported
echo -n "  Bob entries:  "; curl -s "$BASE/entries?from=$TODAY&to=$TODAY" -H "$AUTH_B" | pick meta.totalItems

echo "== AI status + extract guards =="
echo -n "  ai available: "; curl -s "$BASE/ai/status" -H "$AUTH_A" | pick available
echo -n "  extract no file: "; curl -s -X POST "$BASE/ai/extract" -H "$AUTH_A" | pick error.message

echo "== chat (one turn: log a meal) =="
curl -s -X POST "$BASE/ai/chat" -H "$AUTH_B" -H 'Content-Type: application/json' \
  -d "{\"today\":\"$TODAY\",\"messages\":[{\"role\":\"user\",\"content\":\"Log a boiled egg for breakfast, about 80 calories\"}]}" \
  > "$WORK/chat.json" || true
echo -n "  reply present: "; node -e 'const o=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); console.log(Boolean(o.reply||o.error))' "$WORK/chat.json"
echo -n "  actions:       "; pick actions < "$WORK/chat.json"
echo -n "  Bob entries after chat: "; curl -s "$BASE/entries?from=$TODAY&to=$TODAY" -H "$AUTH_B" | pick meta.totalItems

echo
echo "done"
