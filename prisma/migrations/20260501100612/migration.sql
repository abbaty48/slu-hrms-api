/*
  Warnings:

  - You are about to drop the column `chairman` on the `committee` table. All the data in the column will be lost.
  - You are about to drop the column `department_id` on the `committee` table. All the data in the column will be lost.
  - You are about to drop the column `meeting_schedule` on the `committee` table. All the data in the column will be lost.
  - You are about to drop the column `purpose` on the `committee` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "committee" DROP CONSTRAINT "committee_department_id_fkey";

-- AlterTable
ALTER TABLE "committee" DROP COLUMN "chairman",
DROP COLUMN "department_id",
DROP COLUMN "meeting_schedule",
DROP COLUMN "purpose",
ADD COLUMN     "abbre" TEXT,
ADD COLUMN     "departmentId" TEXT;

-- AddForeignKey
ALTER TABLE "committee" ADD CONSTRAINT "committee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
