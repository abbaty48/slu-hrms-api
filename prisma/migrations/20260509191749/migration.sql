/*
  Warnings:

  - You are about to drop the column `benefits` on the `nature_of_appointments` table. All the data in the column will be lost.
  - You are about to drop the column `duration` on the `nature_of_appointments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "nature_of_appointments" DROP COLUMN "benefits",
DROP COLUMN "duration";
