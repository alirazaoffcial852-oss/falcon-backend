-- Per-phase execution state on RouteDailyPlanPhaseDriver.
ALTER TABLE "route_daily_plan_phase_drivers"
ADD COLUMN "trip_started_at" TIMESTAMP(3);

ALTER TABLE "route_daily_plan_phase_drivers"
ADD COLUMN "status" "RouteStatus" NOT NULL DEFAULT 'PENDING';

-- Backfill from existing plans (best-effort).
UPDATE "route_daily_plan_phase_drivers" AS pd
SET "status" = 'COMPLETED'
FROM "route_daily_plans" AS p
WHERE pd."route_daily_plan_id" = p."id"
  AND p."status" = 'COMPLETED';

UPDATE "route_daily_plan_phase_drivers" AS pd
SET "status" = 'CANCELLED'
FROM "route_daily_plans" AS p
WHERE pd."route_daily_plan_id" = p."id"
  AND p."status" = 'CANCELLED';

UPDATE "route_daily_plan_phase_drivers" AS pd
SET
  "trip_started_at" = p."started_at",
  "status" = 'ONGOING'
FROM "route_daily_plans" AS p
WHERE pd."route_daily_plan_id" = p."id"
  AND pd."phase" = 'PICKUP'
  AND p."status" = 'ONGOING'
  AND p."started_at" IS NOT NULL;
