-- Backfill phase driver rows for RouteDailyPlan records created before this feature.
-- We freeze the cron/template assigned driver_id from definition route.

INSERT INTO "route_daily_plan_phase_drivers" (
    "route_daily_plan_id",
    "phase",
    "driver_id",
    "phase_started_at",
    "created_at",
    "updated_at"
)
SELECT
    p."id" AS "route_daily_plan_id",
    'PICKUP'::"RouteDailyPlanPhase" AS "phase",
    r."driver_id" AS "driver_id",
    NULL AS "phase_started_at",
    NOW() AS "created_at",
    NOW() AS "updated_at"
FROM "route_daily_plans" p
JOIN "routes" r ON r."id" = p."definition_route_id"
ON CONFLICT ("route_daily_plan_id", "phase") DO NOTHING;

INSERT INTO "route_daily_plan_phase_drivers" (
    "route_daily_plan_id",
    "phase",
    "driver_id",
    "phase_started_at",
    "created_at",
    "updated_at"
)
SELECT
    p."id" AS "route_daily_plan_id",
    'DROP'::"RouteDailyPlanPhase" AS "phase",
    r."driver_id" AS "driver_id",
    NULL AS "phase_started_at",
    NOW() AS "created_at",
    NOW() AS "updated_at"
FROM "route_daily_plans" p
JOIN "routes" r ON r."id" = p."definition_route_id"
ON CONFLICT ("route_daily_plan_id", "phase") DO NOTHING;

