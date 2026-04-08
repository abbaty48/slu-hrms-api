-- CreateEnum
CREATE TYPE "degree_type" AS ENUM ('PHD', 'MSC', 'PGD', 'BSC');

-- CreateEnum
CREATE TYPE "study_mode" AS ENUM ('FULL_TIME', 'PART_TIME');

-- CreateEnum
CREATE TYPE "sponsorship_type" AS ENUM ('Self', 'StateGovernment', 'UniversityBase', 'TedFund', 'Others');

-- CreateEnum
CREATE TYPE "leave_category" AS ENUM ('Study', 'Medical', 'Maternity', 'Paternity', 'Other');

-- CreateEnum
CREATE TYPE "pay_status" AS ENUM ('WithPayment', 'WithoutPayment');

-- AlterTable
ALTER TABLE "leaves" ADD COLUMN     "study_leave_details" JSON;

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");
