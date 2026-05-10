/*
  Warnings:

  - You are about to drop the column `staffs` on the `committee_members` table. All the data in the column will be lost.
  - You are about to drop the `committees` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `staff_id` to the `committee_members` table without a default value. This is not possible if the table is not empty.
  - Added the required column `group_id` to the `documents` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "committee_members" DROP CONSTRAINT "committee_members_committee_id_fkey";

-- DropForeignKey
ALTER TABLE "committees" DROP CONSTRAINT "committees_department_id_fkey";

-- AlterTable
ALTER TABLE "committee_members" DROP COLUMN "staffs",
ADD COLUMN     "staff_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "group_id" TEXT NOT NULL;

-- DropTable
DROP TABLE "committees";

-- CreateTable
CREATE TABLE "committee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "chairman" TEXT,
    "purpose" TEXT,
    "description" TEXT,
    "meeting_schedule" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "department_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "committee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "committee_name_key" ON "committee"("name");

-- AddForeignKey
ALTER TABLE "committee" ADD CONSTRAINT "committee_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "committee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
