/*
  Warnings:

  - You are about to drop the column `current_lat` on the `drivers` table. All the data in the column will be lost.
  - You are about to drop the column `current_long` on the `drivers` table. All the data in the column will be lost.
  - You are about to drop the column `location_updated_at` on the `drivers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "drivers" DROP COLUMN "current_lat",
DROP COLUMN "current_long",
DROP COLUMN "location_updated_at";
