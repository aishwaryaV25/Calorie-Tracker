#!/usr/bin/env bash
# Manual smoke test for goal versioning. Assumes the server is running on $BASE.
set -euo pipefail

BASE="${BASE:-http://localhost:4000/api}"
STAMP="$(date +%s)"

pick() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);console.log(process.argv[1].split(".").reduce((a,k)=>a?.[k],o))})' "$1"; }
show() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log("  "+s))'; }

TOKEN=$(curl -s -X POST "$BASE/auth/signup" -H 'Content-Type: application/json' \
  -d "{\"email\":\"goals+$STAMP@example.com\",\"password\":\"supersecret1\",\"displayName\":\"Goals\"}" | pick token)
AUTH="Authorization: Bearer $TOKEN"

echo "== before any goal is set =="
curl -s "$BASE/goals/current" -H "$AUTH" | show

echo "== set january targets =="
curl -s -X POST "$BASE/goals" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"dailyCalories":2000,"proteinGrams":140,"carbGrams":200,"fatGrams":60,"targetWeightKg":72,"effectiveFrom":"2026-01-01"}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const g=JSON.parse(s);console.log("  ",g.effectiveFrom,g.dailyCalories,"kcal, weight goal",g.targetWeightKg)})'

echo "== raise targets from august =="
curl -s -X POST "$BASE/goals" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"dailyCalories":2400,"proteinGrams":170,"carbGrams":240,"fatGrams":70,"effectiveFrom":"2026-08-01"}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const g=JSON.parse(s);console.log("  ",g.effectiveFrom,g.dailyCalories,"kcal")})'

echo "== saving again for the same date replaces that version =="
curl -s -o /dev/null -X POST "$BASE/goals" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"dailyCalories":2500,"proteinGrams":175,"carbGrams":245,"fatGrams":72,"effectiveFrom":"2026-08-01"}'
curl -s "$BASE/goals?pageSize=10" -H "$AUTH" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);console.log("  history:",o.data.map(g=>g.effectiveFrom+" -> "+g.dailyCalories).join(", "),"| versions:",o.meta.totalItems)})'

echo "== goal history is paginated =="
curl -s "$BASE/goals?page=1&pageSize=1" -H "$AUTH" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log("  ",JSON.stringify(JSON.parse(s).meta)))'

echo "== current resolves to the newest applicable version =="
curl -s "$BASE/goals/current" -H "$AUTH" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const g=JSON.parse(s).goal;console.log("  ",g.effectiveFrom,g.dailyCalories,"kcal")})'

echo "== validation =="
curl -s -X POST "$BASE/goals" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"dailyCalories":-5,"proteinGrams":140,"carbGrams":200,"fatGrams":60}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log("  ",JSON.stringify(JSON.parse(s).error.details)))'

echo "== another user sees no goals =="
OTHER=$(curl -s -X POST "$BASE/auth/signup" -H 'Content-Type: application/json' \
  -d "{\"email\":\"other+$STAMP@example.com\",\"password\":\"supersecret1\",\"displayName\":\"Other\"}" | pick token)
curl -s "$BASE/goals/current" -H "Authorization: Bearer $OTHER" | show

echo "done"
