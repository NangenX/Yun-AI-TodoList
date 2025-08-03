/*
  Warnings:

  - You are about to drop the column `deletedAt` on the `todos` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `users` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "idx_todos_soft_delete";

-- DropIndex
DROP INDEX "idx_users_soft_delete";

-- AlterTable
ALTER TABLE "todos" DROP COLUMN "deletedAt";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "deletedAt";
