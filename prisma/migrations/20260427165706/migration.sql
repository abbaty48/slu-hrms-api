/*
  Warnings:

  - You are about to drop the column `is_current` on the `employment_history` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "employment_history" DROP COLUMN "is_current",
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT false;
