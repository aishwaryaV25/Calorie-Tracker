#!/usr/bin/env bash
# Manual smoke test for the entries API. Assumes the server is running on $BASE.
set -euo pipefail

BASE="${BASE:-http://localhost:4000/api}"
STAMP="$(date +%s)"

json() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);console.log(process.argv[1].split(".").reduce((a,k)=>a?.[k],o))})' "$1"; }

echo "== create two users =="
A_TOKEN=$(curl -s -X POST "$BASE/auth/signup" -H 'Content-Type: application/json' \
  -d "{\"email\":\"alice+$STAMP@example.com\",\"password\":\"supersecret1\",\"displayName\":\"Alice\"}" | json token)
B_TOKEN=$(curl -s -X POST "$BASE/auth/signup" -H 'Content-Type: application/json' \
  -d "{\"email\":\"bob+$STAMP@example.com\",\"password\":\"supersecret1\",\"displayName\":\"Bob\"}" | json token)
echo "alice and bob registered"

echo "== reject unauthenticated read =="
curl -s -o /dev/null -w "  no token -> %{http_code}\n" "$BASE/entries"

echo "== create entries for alice =="
ENTRY_ID=$(curl -s -X POST "$BASE/entries" -H "Authorization: Bearer $A_TOKEN" -H 'Content-Type: application/json' -d '{
  "foodName":"Greek yoghurt","mealType":"breakfast","quantity":200,"unit":"g",
  "calories":146,"proteinGrams":20,"carbGrams":8,"fatGrams":4,
  "consumedAt":"2026-08-10T07:30:00Z",
  "micronutrients":[{"nutrient":"calcium","amount":220},{"nutrient":"calcium","amount":240},{"nutrient":"vitamin_b12","amount":1.2}]
}' | json id)
echo "  created $ENTRY_ID"

curl -s -o /dev/null -X POST "$BASE/entries" -H "Authorization: Bearer $A_TOKEN" -H 'Content-Type: application/json' -d '{
  "foodName":"Chicken salad","mealType":"lunch","quantity":350,"unit":"g",
  "calories":480,"proteinGrams":42,"carbGrams":18,"fatGrams":26,"consumedAt":"2026-08-11T12:15:00Z"
}'
curl -s -o /dev/null -X POST "$BASE/entries" -H "Authorization: Bearer $A_TOKEN" -H 'Content-Type: application/json' -d '{
  "foodName":"Almonds","mealType":"snack","quantity":30,"unit":"g",
  "calories":174,"proteinGrams":6,"carbGrams":6,"fatGrams":15,"consumedAt":"2026-08-20T16:00:00Z"
}'
echo "  3 entries total"

echo "== duplicate nutrient keys collapsed, units canonicalised =="
curl -s "$BASE/entries/$ENTRY_ID" -H "Authorization: Bearer $A_TOKEN" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log("  ",JSON.stringify(JSON.parse(s).micronutrients)))'

echo "== pagination =="
curl -s "$BASE/entries?page=1&pageSize=2" -H "Authorization: Bearer $A_TOKEN" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);console.log("  page1:",o.data.map(e=>e.foodName).join(", "),"| meta:",JSON.stringify(o.meta))})'
curl -s "$BASE/entries?page=2&pageSize=2" -H "Authorization: Bearer $A_TOKEN" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);console.log("  page2:",o.data.map(e=>e.foodName).join(", "),"| hasNext:",o.meta.hasNextPage)})'

echo "== date range is inclusive of the end day =="
curl -s "$BASE/entries?from=2026-08-10&to=2026-08-11" -H "Authorization: Bearer $A_TOKEN" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);console.log("  10th-11th:",o.meta.totalItems,"entries, totals:",JSON.stringify(o.totals))})'

echo "== meal type filter =="
curl -s "$BASE/entries?mealType=lunch" -H "Authorization: Bearer $A_TOKEN" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);console.log("  lunch:",o.data.map(e=>e.foodName).join(", "))})'

echo "== bob cannot see or touch alice's entry =="
curl -s "$BASE/entries" -H "Authorization: Bearer $B_TOKEN" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log("  bob list count:",JSON.parse(s).meta.totalItems))'
curl -s -o /dev/null -w "  bob GET alice entry -> %{http_code}\n" "$BASE/entries/$ENTRY_ID" -H "Authorization: Bearer $B_TOKEN"
curl -s -o /dev/null -w "  bob DELETE alice entry -> %{http_code}\n" -X DELETE "$BASE/entries/$ENTRY_ID" -H "Authorization: Bearer $B_TOKEN"

echo "== validation =="
curl -s -X POST "$BASE/entries" -H "Authorization: Bearer $A_TOKEN" -H 'Content-Type: application/json' \
  -d '{"foodName":"","mealType":"brunch","quantity":-5,"unit":"g","calories":100}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log("  ",JSON.stringify(JSON.parse(s).error.details)))'
curl -s "$BASE/entries?from=2026-08-20&to=2026-08-01" -H "Authorization: Bearer $A_TOKEN" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log("  reversed range:",JSON.parse(s).error.details[0].message))'

echo "== update and delete =="
curl -s -X PATCH "$BASE/entries/$ENTRY_ID" -H "Authorization: Bearer $A_TOKEN" -H 'Content-Type: application/json' \
  -d '{"calories":150,"micronutrients":[{"nutrient":"iron","amount":2.5}]}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);console.log("  calories:",o.calories,"micros:",JSON.stringify(o.micronutrients.map(m=>m.nutrient)))})'
curl -s -o /dev/null -w "  delete own entry -> %{http_code}\n" -X DELETE "$BASE/entries/$ENTRY_ID" -H "Authorization: Bearer $A_TOKEN"
curl -s -o /dev/null -w "  get deleted entry -> %{http_code}\n" "$BASE/entries/$ENTRY_ID" -H "Authorization: Bearer $A_TOKEN"

echo "done"
