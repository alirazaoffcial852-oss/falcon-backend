-- Planned start times for PICKUP / DROP phases (HH:MM) derived from route_legs.
ALTER TABLE "route_daily_plan_phase_drivers"
ADD COLUMN "pickup_phase_start_time" TEXT;

ALTER TABLE "route_daily_plan_phase_drivers"
ADD COLUMN "drop_phase_start_time" TEXT;

