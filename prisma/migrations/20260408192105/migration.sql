-- CreateEnum
CREATE TYPE "extension_status" AS ENUM ('Pending', 'Approved', 'Rejected');

-- CreateEnum
CREATE TYPE "extension_type" AS ENUM ('First', 'Second', 'Final');

-- CreateTable
CREATE TABLE "academic_extension_requests" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "extension" "extension_type" NOT NULL,
    "duration_months" INTEGER NOT NULL,
    "status" "extension_status" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_extension_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "academic_extension_requests" ADD CONSTRAINT "academic_extension_requests_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
