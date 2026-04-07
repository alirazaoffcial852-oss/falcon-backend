-- Align DB with schema.prisma: pricing columns, status default, driver index.

ALTER TABLE "route_daily_plan_phase_drivers" ADD COLUMN "trip_price" DOUBLE PRECISION;

ALTER TABLE "route_daily_plan_phase_passengers"
  ALTER COLUMN "status" SET DEFAULT 'PENDING'::"PhasePassengerStatus";

ALTER TABLE "routes" ADD COLUMN "route_price" DOUBLE PRECISION;

CREATE INDEX "routes_driver_id_idx" ON "routes"("driver_id");
