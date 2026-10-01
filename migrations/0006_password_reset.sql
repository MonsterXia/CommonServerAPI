ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "PasswordResetChallenge" (
    "username" TEXT PRIMARY KEY NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" INTEGER NOT NULL,
    "sentAt" INTEGER NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0
);
