-- Single planned time per phase row; replaces pickup_phase_start_time + drop_phase_start_time.
ALTER TABLE "route_daily_plan_phase_drivers"
ADD COLUMN "trip_start_time" TEXT;

UPDATE "route_daily_plan_phase_drivers"
SET "trip_start_time" = "pickup_phase_start_time"
WHERE "phase" = 'PICKUP';

UPDATE "route_daily_plan_phase_drivers"
SET "trip_start_time" = "drop_phase_start_time"
WHERE "phase" = 'DROP';

ALTER TABLE "route_daily_plan_phase_drivers"
DROP COLUMN "pickup_phase_start_time",
DROP COLUMN "drop_phase_start_time";
