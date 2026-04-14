ALTER TABLE "driver_assign_cars"
ADD COLUMN "is_default" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "driver_assign_cars_driver_id_car_id_key"
ON "driver_assign_cars"("driver_id", "car_id");

ALTER TABLE "route_daily_plan_phase_drivers"
ADD COLUMN "selected_car_id" INTEGER,
ADD COLUMN "trip_km" DOUBLE PRECISION;

ALTER TABLE "route_daily_plan_phase_drivers"
ADD CONSTRAINT "route_daily_plan_phase_drivers_selected_car_id_fkey"
FOREIGN KEY ("selected_car_id") REFERENCES "cars"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
