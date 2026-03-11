-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HypergryphAccount" (
    "phone" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HypergryphAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_HypergryphAccount" ("createdAt", "token", "updatedAt", "userId") SELECT "createdAt", "token", "updatedAt", "userId" FROM "HypergryphAccount";
DROP TABLE "HypergryphAccount";
ALTER TABLE "new_HypergryphAccount" RENAME TO "HypergryphAccount";
CREATE UNIQUE INDEX "HypergryphAccount_userId_key" ON "HypergryphAccount"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
