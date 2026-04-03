-- Backfill phase passenger rows for plans that have phase drivers but no per-phase passenger rows yet.
-- Passengers are taken from the definition route's legs (same source as cloned execution legs).

INSERT INTO "route_daily_plan_phase_passengers" (
    "route_daily_plan_phase_driver_id",
    "passenger_id",
    "status",
    "created_at",
    "updated_at"
)
SELECT DISTINCT
    pd."id",
    rl."passenger_id",
    'PENDING'::"PickupStatus",
    NOW(),
    NOW()
FROM "route_daily_plans" p
JOIN "routes" def ON def."id" = p."definition_route_id"
JOIN "route_batches" rb ON rb."route_id" = def."id"
JOIN "route_legs" rl ON rl."batch_id" = rb."id"
JOIN "route_daily_plan_phase_drivers" pd
    ON pd."route_daily_plan_id" = p."id" AND pd."phase" = 'PICKUP'
WHERE NOT EXISTS (
    SELECT 1
    FROM "route_daily_plan_phase_passengers" x
    WHERE x."route_daily_plan_phase_driver_id" = pd."id"
      AND x."passenger_id" = rl."passenger_id"
);

INSERT INTO "route_daily_plan_phase_passengers" (
    "route_daily_plan_phase_driver_id",
    "passenger_id",
    "status",
    "created_at",
    "updated_at"
)
SELECT DISTINCT
    pd."id",
    rl."passenger_id",
    'PENDING'::"PickupStatus",
    NOW(),
    NOW()
FROM "route_daily_plans" p
JOIN "routes" def ON def."id" = p."definition_route_id"
JOIN "route_batches" rb ON rb."route_id" = def."id"
JOIN "route_legs" rl ON rl."batch_id" = rb."id"
JOIN "route_daily_plan_phase_drivers" pd
    ON pd."route_daily_plan_id" = p."id" AND pd."phase" = 'DROP'
WHERE NOT EXISTS (
    SELECT 1
    FROM "route_daily_plan_phase_passengers" x
    WHERE x."route_daily_plan_phase_driver_id" = pd."id"
      AND x."passenger_id" = rl."passenger_id"
);
