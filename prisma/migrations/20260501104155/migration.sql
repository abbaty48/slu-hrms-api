/*
  Warnings:

  - You are about to drop the column `departmentId` on the `committee` table. All the data in the column will be lost.
  - Added the required column `faculty_id` to the `departments` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "committee" DROP CONSTRAINT "committee_departmentId_fkey";

-- AlterTable
ALTER TABLE "committee" DROP COLUMN "departmentId";

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "faculty_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Faculty" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "dean_id" TEXT,

    CONSTRAINT "Faculty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_code_key" ON "Faculty"("code");

-- AddForeignKey
ALTER TABLE "Faculty" ADD CONSTRAINT "Faculty_dean_id_fkey" FOREIGN KEY ("dean_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
