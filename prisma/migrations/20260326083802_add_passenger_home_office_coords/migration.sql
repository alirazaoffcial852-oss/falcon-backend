-- AlterTable
ALTER TABLE "passengers" ADD COLUMN     "home_address" TEXT,
ADD COLUMN     "home_lat" DOUBLE PRECISION,
ADD COLUMN     "home_long" DOUBLE PRECISION,
ADD COLUMN     "office_lat" DOUBLE PRECISION,
ADD COLUMN     "office_long" DOUBLE PRECISION;
