/*
  Warnings:

  - You are about to drop the column `aiEnabled` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `aiMaxTokens` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `aiModel` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `aiTemperature` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `autoAnalyze` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `autoSync` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `conflictResolution` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `desktopNotifications` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `dueReminder` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `emailNotifications` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `offlineMode` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `reminderMinutes` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `requestTimeout` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `retryAttempts` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `storageMode` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `syncInterval` on the `user_preferences` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "idx_user_preferences_language";

-- DropIndex
DROP INDEX "idx_user_preferences_theme";

-- AlterTable
ALTER TABLE "user_preferences" DROP COLUMN "aiEnabled",
DROP COLUMN "aiMaxTokens",
DROP COLUMN "aiModel",
DROP COLUMN "aiTemperature",
DROP COLUMN "autoAnalyze",
DROP COLUMN "autoSync",
DROP COLUMN "conflictResolution",
DROP COLUMN "desktopNotifications",
DROP COLUMN "dueReminder",
DROP COLUMN "emailNotifications",
DROP COLUMN "offlineMode",
DROP COLUMN "reminderMinutes",
DROP COLUMN "requestTimeout",
DROP COLUMN "retryAttempts",
DROP COLUMN "storageMode",
DROP COLUMN "syncInterval";
