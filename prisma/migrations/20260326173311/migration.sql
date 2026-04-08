/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `committees` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "committees_name_key" ON "committees"("name");
