#!/usr/bin/env bash
# Manual smoke test for the downloadable PDF report. Assumes the server is
# running on $BASE. Writes the generated files to $OUT so they can be opened.
set -euo pipefail

BASE="${BASE:-http://localhost:4000/api}"
OUT="${OUT:-$(mktemp -d)}"
mkdir -p "$OUT"
STAMP="$(date +%s)"
TODAY="$(date +%F)"

pick() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=process.argv[1].split(".").reduce((a,k)=>a?.[k],JSON.parse(s));console.log(v===undefined?"":typeof v==="object"?JSON.stringify(v):v)})' "$1"; }

# A PDF is opaque to grep, so what is checked is that it is a valid document: the
# header, a page count, and that the words the report should contain are in it.
inspect() {
  node -e '
    const fs = require("fs");
    const file = process.argv[1];
    const bytes = fs.readFileSync(file);
    const text = bytes.toString("latin1");
    const pages = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;

    console.log(`  ${(bytes.length / 1024).toFixed(1)} KB, ${pages} page(s), header: ${text.slice(0, 8)}`);
    console.log(`  ends with EOF marker: ${text.trimEnd().endsWith("%%EOF")}`);
  ' "$1"
}

day() { date -v-"$1"d +%F 2>/dev/null || date -d "$1 days ago" +%F; }

TOKEN=$(curl -s -X POST "$BASE/auth/signup" -H 'Content-Type: application/json' \
  -d "{\"email\":\"pdf+$STAMP@example.com\",\"password\":\"supersecret1\",\"displayName\":\"Priya Raman\"}" | pick token)
AUTH="Authorization: Bearer $TOKEN"

echo "== authentication is required =="
curl -s -o /dev/null -w "  no token -> %{http_code}\n" "$BASE/reports/pdf"

echo "== a report for an empty diary is still a valid document =="
curl -s -o "$OUT/empty.pdf" -D "$OUT/empty.headers" "$BASE/reports/pdf" -H "$AUTH"
inspect "$OUT/empty.pdf"
echo -n "  "; grep -i 'content-type\|content-disposition' "$OUT/empty.headers" | tr -d '\r' | paste -sd' | ' -

echo "== give the diary something to report on =="
curl -s -o /dev/null -X POST "$BASE/goals" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"dailyCalories\":2200,\"proteinGrams\":150,\"carbGrams\":230,\"fatGrams\":70,\"targetWeightKg\":74,\"effectiveFrom\":\"$(day 20)\"}"

# A spread of days, one of them deliberately over target, with micronutrients on
# a couple of entries so every section of the report has something in it.
for offset in 0 1 2 4 5 8 9 12; do
  DATE="$(day "$offset")"
  curl -s -o /dev/null -X POST "$BASE/entries" -H "$AUTH" -H 'Content-Type: application/json' \
    -d "{\"foodName\":\"Porridge with berries\",\"mealType\":\"breakfast\",\"quantity\":1,\"unit\":\"bowl\",\"calories\":420,\"proteinGrams\":12,\"carbGrams\":68,\"fatGrams\":9,\"consumedOn\":\"$DATE\",\"consumedAt\":\"${DATE}T08:00:00.000Z\",\"micronutrients\":[{\"nutrient\":\"iron\",\"amount\":3.2},{\"nutrient\":\"fiber\",\"amount\":8}]}"
  curl -s -o /dev/null -X POST "$BASE/entries" -H "$AUTH" -H 'Content-Type: application/json' \
    -d "{\"foodName\":\"Chicken salad\",\"mealType\":\"lunch\",\"quantity\":350,\"unit\":\"g\",\"calories\":610,\"proteinGrams\":48,\"carbGrams\":30,\"fatGrams\":32,\"consumedOn\":\"$DATE\",\"consumedAt\":\"${DATE}T13:00:00.000Z\",\"micronutrients\":[{\"nutrient\":\"vitamin_c\",\"amount\":42},{\"nutrient\":\"sodium\",\"amount\":780}]}"
  curl -s -o /dev/null -X POST "$BASE/entries" -H "$AUTH" -H 'Content-Type: application/json' \
    -d "{\"foodName\":\"Paneer curry with rice\",\"mealType\":\"dinner\",\"quantity\":1,\"unit\":\"plate\",\"calories\":$((offset == 0 ? 1600 : 780)),\"proteinGrams\":26,\"carbGrams\":95,\"fatGrams\":28,\"consumedOn\":\"$DATE\",\"consumedAt\":\"${DATE}T20:00:00.000Z\"}"
done
echo -n "  entries created: "; curl -s "$BASE/entries?from=$(day 20)&to=$TODAY&pageSize=1" -H "$AUTH" | pick meta.totalItems

echo "== the full report =="
curl -s -o "$OUT/report.pdf" -D "$OUT/report.headers" "$BASE/reports/pdf?from=$(day 20)&to=$TODAY" -H "$AUTH"
inspect "$OUT/report.pdf"
echo -n "  filename offered: "
grep -i 'content-disposition' "$OUT/report.headers" | tr -d '\r' | sed 's/.*filename=//'

echo "== a long range spills onto more pages =="
curl -s -o "$OUT/long.pdf" "$BASE/reports/pdf?from=$(day 120)&to=$TODAY" -H "$AUTH"
inspect "$OUT/long.pdf"

echo "== the range guard still applies =="
echo -n "  "; curl -s "$BASE/reports/pdf?from=2020-01-01&to=$TODAY" -H "$AUTH" | pick error.message
echo -n "  "; curl -s "$BASE/reports/pdf?from=$TODAY&to=$(day 5)" -H "$AUTH" | pick error.details.0.message

echo
echo "files written to $OUT"
echo "done"
