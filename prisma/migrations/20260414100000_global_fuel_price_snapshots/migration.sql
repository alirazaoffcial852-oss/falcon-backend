CREATE TABLE "fuel_prices" (
    "id" SERIAL NOT NULL,
    "price_per_liter" DOUBLE PRECISION NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fuel_prices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fuel_prices_effective_from_idx" ON "fuel_prices"("effective_from");

ALTER TABLE "route_daily_plan_phase_drivers"
ADD COLUMN "fuel_price_per_liter_snapshot" DOUBLE PRECISION,
ADD COLUMN "km_per_liter_snapshot" DOUBLE PRECISION,
ADD COLUMN "fuel_cost" DOUBLE PRECISION;
