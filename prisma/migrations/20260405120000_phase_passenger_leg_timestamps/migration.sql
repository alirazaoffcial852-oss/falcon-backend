-- Move per-phase timestamps / ack from route_legs to route_daily_plan_phase_passengers.

ALTER TABLE "route_daily_plan_phase_passengers"
ADD COLUMN "driver_arrived_at" TIMESTAMP(3),
ADD COLUMN "passenger_ack" "PassengerAck",
ADD COLUMN "picked_at" TIMESTAMP(3),
ADD COLUMN "dropoff_arrived_at" TIMESTAMP(3),
ADD COLUMN "dropped_at" TIMESTAMP(3);

UPDATE "route_daily_plan_phase_passengers" pp
SET
  "driver_arrived_at" = rl."driver_arrived_at",
  "passenger_ack" = rl."passenger_ack",
  "picked_at" = rl."picked_at"
FROM "route_daily_plan_phase_drivers" pd
JOIN "route_daily_plans" p ON p."id" = pd."route_daily_plan_id"
JOIN "routes" r ON r."route_daily_plan_id" = p."id"
JOIN "route_legs" rl ON rl."route_id" = r."id"
WHERE pp."route_daily_plan_phase_driver_id" = pd."id"
  AND pd."phase" = 'PICKUP'
  AND rl."passenger_id" = pp."passenger_id";

UPDATE "route_daily_plan_phase_passengers" pp
SET
  "dropoff_arrived_at" = rl."dropoff_arrived_at",
  "dropped_at" = rl."dropped_at"
FROM "route_daily_plan_phase_drivers" pd
JOIN "route_daily_plans" p ON p."id" = pd."route_daily_plan_id"
JOIN "routes" r ON r."route_daily_plan_id" = p."id"
JOIN "route_legs" rl ON rl."route_id" = r."id"
WHERE pp."route_daily_plan_phase_driver_id" = pd."id"
  AND pd."phase" = 'DROP'
  AND rl."passenger_id" = pp."passenger_id";

ALTER TABLE "route_legs" DROP COLUMN IF EXISTS "driver_arrived_at";
ALTER TABLE "route_legs" DROP COLUMN IF EXISTS "passenger_ack";
ALTER TABLE "route_legs" DROP COLUMN IF EXISTS "picked_at";
ALTER TABLE "route_legs" DROP COLUMN IF EXISTS "dropoff_arrived_at";
ALTER TABLE "route_legs" DROP COLUMN IF EXISTS "dropped_at";
