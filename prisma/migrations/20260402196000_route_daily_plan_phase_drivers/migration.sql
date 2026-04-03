-- Add who-handled history per phase (pickup/drop) for RouteDailyPlan.
-- Driver id is frozen at cron/template spawn time; phase start time is filled when the segment becomes ONGOING.

-- CreateEnum
CREATE TYPE "RouteDailyPlanPhase" AS ENUM ('PICKUP', 'DROP');

-- CreateTable route_daily_plan_phase_drivers
CREATE TABLE "route_daily_plan_phase_drivers" (
    "id" SERIAL NOT NULL,
    "route_daily_plan_id" INTEGER NOT NULL,
    "phase" "RouteDailyPlanPhase" NOT NULL,
    "driver_id" INTEGER NOT NULL,
    "phase_started_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_daily_plan_phase_drivers_pkey" PRIMARY KEY ("id")
);

-- Unique: one row per (plan, phase)
CREATE UNIQUE INDEX "route_daily_plan_phase_drivers_route_daily_plan_id_phase_key"
    ON "route_daily_plan_phase_drivers"("route_daily_plan_id", "phase");

-- Helper index
CREATE INDEX "route_daily_plan_phase_drivers_driver_id_idx"
    ON "route_daily_plan_phase_drivers"("driver_id");

ALTER TABLE "route_daily_plan_phase_drivers"
    ADD CONSTRAINT "route_daily_plan_phase_drivers_route_daily_plan_id_fkey"
    FOREIGN KEY ("route_daily_plan_id") REFERENCES "route_daily_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "route_daily_plan_phase_drivers"
    ADD CONSTRAINT "route_daily_plan_phase_drivers_driver_id_fkey"
    FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

