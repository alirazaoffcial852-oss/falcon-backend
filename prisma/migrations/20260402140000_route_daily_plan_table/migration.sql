-- Separate trip state: route_daily_plans (definition_route + date + status).
-- Execution routes link via routes.route_daily_plan_id.

CREATE TABLE "route_daily_plans" (
    "id" SERIAL NOT NULL,
    "definition_route_id" INTEGER NOT NULL,
    "scheduled_date" DATE NOT NULL,
    "status" "RouteStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_daily_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "route_daily_plans_definition_route_id_scheduled_date_key"
    ON "route_daily_plans"("definition_route_id", "scheduled_date");
CREATE INDEX "route_daily_plans_scheduled_date_idx" ON "route_daily_plans"("scheduled_date");

ALTER TABLE "route_daily_plans"
    ADD CONSTRAINT "route_daily_plans_definition_route_id_fkey"
    FOREIGN KEY ("definition_route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "routes" ADD COLUMN "route_daily_plan_id" INTEGER;

-- Backfill from old template instances
INSERT INTO "route_daily_plans" (
    "definition_route_id",
    "scheduled_date",
    "status",
    "started_at",
    "completed_at",
    "created_at",
    "updated_at"
)
SELECT
    r."source_template_id",
    r."scheduled_date"::date,
    r."status"::text::"RouteStatus",
    r."started_at",
    r."completed_at",
    NOW(),
    NOW()
FROM "routes" r
WHERE r."source_template_id" IS NOT NULL
  AND r."scheduled_date" IS NOT NULL;

UPDATE "routes" r
SET "route_daily_plan_id" = p."id"
FROM "route_daily_plans" p
WHERE r."source_template_id" IS NOT NULL
  AND r."scheduled_date" IS NOT NULL
  AND p."definition_route_id" = r."source_template_id"
  AND p."scheduled_date" = r."scheduled_date"::date;

ALTER TABLE "routes" ADD CONSTRAINT "routes_route_daily_plan_id_fkey"
    FOREIGN KEY ("route_daily_plan_id") REFERENCES "route_daily_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "routes_route_daily_plan_id_key" ON "routes"("route_daily_plan_id");

-- Remove trip/template columns from routes (status lives on route_daily_plans)
ALTER TABLE "routes" DROP CONSTRAINT IF EXISTS "routes_source_template_id_fkey";
ALTER TABLE "routes" DROP COLUMN IF EXISTS "source_template_id";
ALTER TABLE "routes" DROP COLUMN IF EXISTS "is_template";
ALTER TABLE "routes" DROP COLUMN IF EXISTS "scheduled_date";
ALTER TABLE "routes" DROP COLUMN IF EXISTS "status";
ALTER TABLE "routes" DROP COLUMN IF EXISTS "started_at";
ALTER TABLE "routes" DROP COLUMN IF EXISTS "completed_at";

DROP INDEX IF EXISTS "routes_driver_id_scheduled_date_idx";
DROP INDEX IF EXISTS "routes_source_template_id_scheduled_date_idx";
