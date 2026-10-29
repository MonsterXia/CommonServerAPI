-- Fail safely if duplicate non-null emails exist; never discard accounts.
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "RegistrationChallenge" (
    "email" TEXT NOT NULL PRIMARY KEY,
    "codeHash" TEXT NOT NULL,
    "expiresAt" INTEGER NOT NULL
);

CREATE TABLE "EmailDailyQuota" (
    "day" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL DEFAULT 0 CHECK ("count" >= 0 AND "count" <= 100)
);
