-- Replace phase_started_at with scheduled_date (denormalized from route_daily_plans).

ALTER TABLE "route_daily_plan_phase_drivers"
ADD COLUMN "scheduled_date" DATE;

UPDATE "route_daily_plan_phase_drivers" AS pd
SET "scheduled_date" = p."scheduled_date"
FROM "route_daily_plans" AS p
WHERE pd."route_daily_plan_id" = p."id";

ALTER TABLE "route_daily_plan_phase_drivers"
ALTER COLUMN "scheduled_date" SET NOT NULL;

ALTER TABLE "route_daily_plan_phase_drivers"
DROP COLUMN "phase_started_at";

CREATE INDEX "route_daily_plan_phase_drivers_driver_id_scheduled_date_idx"
ON "route_daily_plan_phase_drivers" ("driver_id", "scheduled_date");
