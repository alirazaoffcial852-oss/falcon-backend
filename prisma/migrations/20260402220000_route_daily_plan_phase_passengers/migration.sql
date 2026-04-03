-- Align migration history with DB: phone_no was already nullable in dev
ALTER TABLE "companies" ALTER COLUMN "phone_no" DROP NOT NULL;

-- Per-phase-driver passenger rows (pickup/drop leg tracking)
CREATE TABLE "route_daily_plan_phase_passengers" (
    "id" SERIAL NOT NULL,
    "route_daily_plan_phase_driver_id" INTEGER NOT NULL,
    "passenger_id" INTEGER NOT NULL,
    "status" "PickupStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_daily_plan_phase_passengers_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "route_daily_plan_phase_passengers"
    ADD CONSTRAINT "route_daily_plan_phase_passengers_route_daily_plan_phase_driver_id_fkey"
    FOREIGN KEY ("route_daily_plan_phase_driver_id") REFERENCES "route_daily_plan_phase_drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "route_daily_plan_phase_passengers"
    ADD CONSTRAINT "route_daily_plan_phase_passengers_passenger_id_fkey"
    FOREIGN KEY ("passenger_id") REFERENCES "passengers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
