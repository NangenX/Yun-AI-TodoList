/*
  Warnings:

  - You are about to drop the column `priorityAnalysis` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `subtaskSplitting` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `timeEstimation` on the `user_preferences` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "user_preferences" DROP COLUMN "priorityAnalysis",
DROP COLUMN "subtaskSplitting",
DROP COLUMN "timeEstimation",
ADD COLUMN     "enablePriorityAnalysis" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "enableSubtaskSplitting" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "enableTimeEstimation" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "language" SET DEFAULT 'zh';
