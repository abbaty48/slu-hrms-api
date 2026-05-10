/*
  Warnings:

  - You are about to drop the column `level` on the `ranks` table. All the data in the column will be lost.
  - You are about to drop the column `department` on the `responsibilities` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `responsibilities` table. All the data in the column will be lost.
  - You are about to drop the `staff_responsibilities` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "staff_responsibilities" DROP CONSTRAINT "staff_responsibilities_responsibility_id_fkey";

-- DropForeignKey
ALTER TABLE "staff_responsibilities" DROP CONSTRAINT "staff_responsibilities_staff_id_fkey";

-- AlterTable
ALTER TABLE "ranks" DROP COLUMN "level";

-- AlterTable
ALTER TABLE "responsibilities" DROP COLUMN "department",
DROP COLUMN "priority";

-- DropTable
DROP TABLE "staff_responsibilities";

-- DropEnum
DROP TYPE "responsibility_priority";
