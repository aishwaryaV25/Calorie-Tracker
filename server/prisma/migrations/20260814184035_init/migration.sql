-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dailyCalories" REAL NOT NULL,
    "proteinGrams" REAL NOT NULL,
    "carbGrams" REAL NOT NULL,
    "fatGrams" REAL NOT NULL,
    "targetWeightKg" REAL,
    "effectiveFrom" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FoodEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "foodName" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "calories" REAL NOT NULL,
    "proteinGrams" REAL NOT NULL DEFAULT 0,
    "carbGrams" REAL NOT NULL DEFAULT 0,
    "fatGrams" REAL NOT NULL DEFAULT 0,
    "consumedAt" DATETIME NOT NULL,
    "consumedOn" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FoodEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NutrientAmount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "nutrient" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    CONSTRAINT "NutrientAmount_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FoodEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Goal_userId_effectiveFrom_idx" ON "Goal"("userId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "FoodEntry_userId_consumedOn_idx" ON "FoodEntry"("userId", "consumedOn");

-- CreateIndex
CREATE INDEX "FoodEntry_userId_mealType_idx" ON "FoodEntry"("userId", "mealType");

-- CreateIndex
CREATE INDEX "NutrientAmount_nutrient_idx" ON "NutrientAmount"("nutrient");

-- CreateIndex
CREATE UNIQUE INDEX "NutrientAmount_entryId_nutrient_key" ON "NutrientAmount"("entryId", "nutrient");
