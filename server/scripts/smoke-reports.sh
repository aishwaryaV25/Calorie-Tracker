#!/usr/bin/env bash
# Manual smoke test for the report endpoints. Assumes the server is running on $BASE.
set -euo pipefail

BASE="${BASE:-http://localhost:4000/api}"
STAMP="$(date +%s)"
RANGE="from=2026-08-01&to=2026-08-14"

pick() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);console.log(process.argv[1].split(".").reduce((a,k)=>a?.[k],o))})' "$1"; }
pretty() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.stringify(JSON.parse(s),null,0)))'; }

TOKEN=$(curl -s -X POST "$BASE/auth/signup" -H 'Content-Type: application/json' \
  -d "{\"email\":\"reports+$STAMP@example.com\",\"password\":\"supersecret1\",\"displayName\":\"Reports\"}" | pick token)
AUTH="Authorization: Bearer $TOKEN"

echo "== seed goals: 2000 kcal from january, 2400 kcal from 8 august =="
curl -s -o /dev/null -X POST "$BASE/goals" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"dailyCalories":2000,"proteinGrams":140,"carbGrams":200,"fatGrams":60,"effectiveFrom":"2026-01-01"}'
curl -s -o /dev/null -X POST "$BASE/goals" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"dailyCalories":2400,"proteinGrams":170,"carbGrams":240,"fatGrams":70,"effectiveFrom":"2026-08-08"}'

echo "== seed entries on 3, 9 and 12 august =="
curl -s -o /dev/null -X POST "$BASE/entries" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "foodName":"Oats","mealType":"breakfast","quantity":100,"unit":"g",
  "calories":500,"proteinGrams":30,"carbGrams":50,"fatGrams":20,"consumedAt":"2026-08-03T08:00:00Z",
  "micronutrients":[{"nutrient":"iron","amount":3},{"nutrient":"vitamin_c","amount":20}]}'
curl -s -o /dev/null -X POST "$BASE/entries" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "foodName":"Rice bowl","mealType":"lunch","quantity":400,"unit":"g",
  "calories":700,"proteinGrams":25,"carbGrams":110,"fatGrams":15,"consumedAt":"2026-08-03T13:00:00Z",
  "micronutrients":[{"nutrient":"iron","amount":2}]}'
curl -s -o /dev/null -X POST "$BASE/entries" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "foodName":"Pasta","mealType":"dinner","quantity":350,"unit":"g",
  "calories":900,"proteinGrams":35,"carbGrams":120,"fatGrams":30,"consumedAt":"2026-08-09T20:00:00Z",
  "micronutrients":[{"nutrient":"sodium","amount":800}]}'
curl -s -o /dev/null -X POST "$BASE/entries" -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "foodName":"Trail mix","mealType":"snack","quantity":50,"unit":"g",
  "calories":300,"proteinGrams":8,"carbGrams":25,"fatGrams":18,"consumedAt":"2026-08-12T16:00:00Z"}'

echo
echo "== daily report: empty days are zero-filled, each day carries its own goal =="
curl -s "$BASE/reports/daily?$RANGE&pageSize=14" -H "$AUTH" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const o=JSON.parse(s);
  console.log("  days returned:",o.meta.totalItems,"| range:",o.range.from,"->",o.range.to);
  for (const r of o.data.filter(r=>r.calories>0||r.date==="2026-08-07"||r.date==="2026-08-08")) {
    console.log("   ",r.date,String(r.calories).padStart(4),"kcal | goal",r.goal?r.goal.dailyCalories:"none","| remaining",r.caloriesRemaining);
  }
});'

echo
echo "== weekly rollup =="
curl -s "$BASE/reports/weekly?$RANGE" -H "$AUTH" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const o=JSON.parse(s);
  for (const w of o.data) console.log("  ",w.weekStart,"->",w.weekEnd,"|",w.calories,"kcal |",w.daysLogged,"days logged | avg/day",w.averageDailyCalories);
});'

echo
echo "== macro breakdown (percentages should sum to 100) =="
curl -s "$BASE/reports/macros?$RANGE" -H "$AUTH" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const o=JSON.parse(s);const p=o.caloriePercentage;
  console.log("   grams:",JSON.stringify(o.grams));
  console.log("   energy share:",JSON.stringify(p),"sum:",Math.round((p.proteinGrams+p.carbGrams+p.fatGrams)*100)/100);
});'

echo
echo "== micronutrient summary (paginated) =="
curl -s "$BASE/reports/micronutrients?$RANGE&pageSize=2" -H "$AUTH" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const o=JSON.parse(s);
  console.log("   page 1 of",o.meta.totalPages,"| total nutrients:",o.meta.totalItems,"| days:",o.days);
  for (const m of o.data) console.log("   ",m.label,m.total,m.unit,"| avg/day",m.averagePerDay);
});'
curl -s "$BASE/reports/micronutrients?$RANGE&page=2&pageSize=2" -H "$AUTH" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const o=JSON.parse(s);
  for (const m of o.data) console.log("    page2:",m.label,m.total,m.unit);
});'

echo
echo "== goal vs actual (target must blend 2000 and 2400 across the range) =="
curl -s "$BASE/reports/goal-comparison?$RANGE" -H "$AUTH" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const o=JSON.parse(s);
  console.log("   days:",o.range.days,"| logged:",o.daysLogged);
  console.log("   actual kcal:",o.actual.calories,"| target kcal:",o.target.calories);
  console.log("   expected target: 7*2000 + 7*2400 =",7*2000+7*2400);
  console.log("   adherence:",JSON.stringify(o.adherence));
});'

echo
echo "== range guard =="
curl -s "$BASE/reports/daily?from=2020-01-01&to=2026-08-14" -H "$AUTH" | pick error.message
curl -s "$BASE/reports/daily?from=2026-08-14&to=2026-08-01" -H "$AUTH" | pick error.details.0.message

echo
echo "== a user with no data still gets a well-formed report =="
EMPTY=$(curl -s -X POST "$BASE/auth/signup" -H 'Content-Type: application/json' \
  -d "{\"email\":\"empty+$STAMP@example.com\",\"password\":\"supersecret1\",\"displayName\":\"Empty\"}" | pick token)
curl -s "$BASE/reports/goal-comparison?$RANGE" -H "Authorization: Bearer $EMPTY" | pretty | sed 's/^/   /'

echo "done"
