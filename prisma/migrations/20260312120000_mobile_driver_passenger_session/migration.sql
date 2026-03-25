-- CreateEnum
CREATE TYPE "PickupStatus" AS ENUM ('PENDING', 'ARRIVED', 'PICKED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "PassengerAck" AS ENUM ('COMING', 'NOT_COMING');

-- AlterTable: User relations (no SQL needed, handled by FK below)

-- AlterTable: Driver - add mobile fields
ALTER TABLE "drivers"
    ADD COLUMN "user_id" INTEGER,
    ADD COLUMN "is_available" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "available_at" TIMESTAMP(3),
    ADD COLUMN "current_lat" DOUBLE PRECISION,
    ADD COLUMN "current_long" DOUBLE PRECISION,
    ADD COLUMN "location_updated_at" TIMESTAMP(3);

-- AlterTable: Passenger - add user_id
ALTER TABLE "passengers"
    ADD COLUMN "user_id" INTEGER;

-- AlterTable: Route - add started_at and completed_at
ALTER TABLE "routes"
    ADD COLUMN "started_at" TIMESTAMP(3),
    ADD COLUMN "completed_at" TIMESTAMP(3);

-- AlterTable: RouteLeg - add mobile tracking fields
-- First drop old pickup_status (was RouteStatus enum) and add new PickupStatus
-- Also drop dropoff_status (not used in mobile flow)
ALTER TABLE "route_legs"
    ADD COLUMN "sequence" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "driver_arrived_at" TIMESTAMP(3),
    ADD COLUMN "passenger_ack" "PassengerAck",
    ADD COLUMN "picked_at" TIMESTAMP(3);

-- Change pickup_status from RouteStatus to PickupStatus
ALTER TABLE "route_legs" DROP COLUMN "pickup_status";
ALTER TABLE "route_legs" ADD COLUMN "pickup_status" "PickupStatus" NOT NULL DEFAULT 'PENDING';

-- Remove dropoff_status (not used, was using wrong enum)
ALTER TABLE "route_legs" DROP COLUMN "dropoff_status";

-- CreateIndex: unique user_id on drivers
CREATE UNIQUE INDEX "drivers_user_id_key" ON "drivers"("user_id");

-- CreateIndex: unique user_id on passengers
CREATE UNIQUE INDEX "passengers_user_id_key" ON "passengers"("user_id");

-- AddForeignKey: Driver -> User
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Passenger -> User
ALTER TABLE "passengers" ADD CONSTRAINT "passengers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
