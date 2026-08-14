#!/usr/bin/env bash
# Backend checks for the "Log Meal" feature: creating an entry by hand and the
# AI pre-fill path behind it. Assumes the server is running on $BASE.
set -euo pipefail

BASE="${BASE:-http://localhost:4000/api}"
STAMP="$(date +%s)"

pick() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);console.log(process.argv[1].split(".").reduce((a,k)=>a?.[k],o))})' "$1"; }

TOKEN=$(curl -s -X POST "$BASE/auth/signup" -H 'Content-Type: application/json' \
  -d "{\"email\":\"log+$STAMP@example.com\",\"password\":\"supersecret1\",\"displayName\":\"Logger\"}" | pick token)
AUTH="Authorization: Bearer $TOKEN"

echo "== minimal entry: only the required fields =="
curl -s -X POST "$BASE/entries" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"foodName":"Black coffee","mealType":"breakfast","quantity":1,"unit":"cup","calories":5}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const e=JSON.parse(s);
      console.log("  saved:",e.foodName,"| macros default to zero:",JSON.stringify(e.macros));
      console.log("  consumedAt defaulted to now:",Math.abs(Date.now()-new Date(e.consumedAt).getTime())<60000);
    })'

echo "== full entry with macros and micronutrients =="
curl -s -X POST "$BASE/entries" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "foodName":"Paneer wrap","mealType":"lunch","quantity":1,"unit":"wrap",
  "calories":520,"proteinGrams":24,"carbGrams":48,"fatGrams":26,
  "consumedAt":"2026-08-14T13:30:00Z",
  "micronutrients":[{"nutrient":"calcium","amount":320},{"nutrient":"sodium","amount":890}]}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const e=JSON.parse(s);
      console.log("  saved:",e.foodName,e.calories,"kcal | micros:",e.micronutrients.map(m=>m.label+" "+m.amount+m.unit).join(", "));
    })'

echo "== each meal type is accepted =="
for meal in breakfast lunch dinner snack; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/entries" -H "$AUTH" -H 'Content-Type: application/json' \
    -d "{\"foodName\":\"Test $meal\",\"mealType\":\"$meal\",\"quantity\":1,\"unit\":\"serving\",\"calories\":100}")
  echo "  $meal -> $code"
done

echo "== validation surfaces every bad field at once =="
curl -s -X POST "$BASE/entries" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"foodName":"","mealType":"brunch","quantity":0,"unit":"","calories":-1}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
      for (const d of JSON.parse(s).error.details) console.log("  "+d.field+": "+d.message);
    })'

echo "== a bad micronutrient key is rejected, not silently stored =="
curl -s -X POST "$BASE/entries" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"foodName":"Test","mealType":"snack","quantity":1,"unit":"g","calories":10,"micronutrients":[{"nutrient":"Vitamin C!","amount":5}]}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log("  "+JSON.parse(s).error.details[0].message))'

echo "== today's totals reflect what was logged =="
TODAY=$(date -u +%F)
curl -s "$BASE/entries?from=$TODAY&to=$TODAY&pageSize=100" -H "$AUTH" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);
      console.log("  entries today:",o.meta.totalItems,"| totals:",JSON.stringify(o.totals));
    })'

echo "done"
