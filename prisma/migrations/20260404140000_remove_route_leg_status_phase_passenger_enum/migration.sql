-- Unify leg progress in RouteDailyPlanPhasePassenger; remove route_legs.pickup_status / dropoff_status.

CREATE TYPE "PhasePassengerStatus" AS ENUM ('PENDING', 'ARRIVED', 'PICKED', 'SKIPPED', 'DROPPED');

ALTER TABLE "route_daily_plan_phase_passengers"
ADD COLUMN "status_tmp" "PhasePassengerStatus";

-- `pp` must not appear in JOIN ON; reference updated row only in WHERE (PostgreSQL).
UPDATE "route_daily_plan_phase_passengers" AS pp
SET "status_tmp" = CASE pd."phase"
  WHEN 'PICKUP' THEN
    CASE rl."pickup_status"::text
      WHEN 'PENDING' THEN 'PENDING'::"PhasePassengerStatus"
      WHEN 'ARRIVED' THEN 'ARRIVED'::"PhasePassengerStatus"
      WHEN 'PICKED' THEN 'PICKED'::"PhasePassengerStatus"
      WHEN 'SKIPPED' THEN 'SKIPPED'::"PhasePassengerStatus"
      ELSE 'PENDING'::"PhasePassengerStatus"
    END
  WHEN 'DROP' THEN
    CASE rl."dropoff_status"::text
      WHEN 'PENDING' THEN 'PENDING'::"PhasePassengerStatus"
      WHEN 'ARRIVED' THEN 'ARRIVED'::"PhasePassengerStatus"
      WHEN 'DROPPED' THEN 'DROPPED'::"PhasePassengerStatus"
      WHEN 'SKIPPED' THEN 'SKIPPED'::"PhasePassengerStatus"
      ELSE 'PENDING'::"PhasePassengerStatus"
    END
  ELSE 'PENDING'::"PhasePassengerStatus"
END
FROM "route_daily_plan_phase_drivers" AS pd
JOIN "route_daily_plans" AS p ON p."id" = pd."route_daily_plan_id"
JOIN "routes" AS r ON r."route_daily_plan_id" = p."id"
JOIN "route_legs" AS rl ON rl."route_id" = r."id"
WHERE pp."route_daily_plan_phase_driver_id" = pd."id"
  AND rl."passenger_id" = pp."passenger_id";

UPDATE "route_daily_plan_phase_passengers"
SET "status_tmp" = 'PENDING'::"PhasePassengerStatus"
WHERE "status_tmp" IS NULL;

ALTER TABLE "route_daily_plan_phase_passengers"
ALTER COLUMN "status_tmp" SET NOT NULL;

ALTER TABLE "route_daily_plan_phase_passengers" DROP COLUMN "status";

ALTER TABLE "route_daily_plan_phase_passengers" RENAME COLUMN "status_tmp" TO "status";

ALTER TABLE "route_legs" DROP COLUMN "pickup_status";
ALTER TABLE "route_legs" DROP COLUMN "dropoff_status";

DROP TYPE IF EXISTS "PickupStatus";
DROP TYPE IF EXISTS "DropoffStatus";
