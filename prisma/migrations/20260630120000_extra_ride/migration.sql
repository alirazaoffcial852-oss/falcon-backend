-- AlterTable
ALTER TABLE "route_daily_plan_phase_drivers" ADD COLUMN "is_extra_ride" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "route_extra_ride_history" (
    "id" SERIAL NOT NULL,
    "route_id" INTEGER NOT NULL,
    "route_daily_plan_id" INTEGER NOT NULL,
    "phase_driver_id" INTEGER NOT NULL,
    "phase" "RouteDailyPlanPhase" NOT NULL,
    "previous_driver_id" INTEGER NOT NULL,
    "new_driver_id" INTEGER NOT NULL,
    "trip_price" DOUBLE PRECISION NOT NULL,
    "fuel_cost" DOUBLE PRECISION,
    "salary_payment_status" "PaymentStatus" NOT NULL,
    "fuel_payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "salary_paid_at" TIMESTAMP(3),
    "fuel_paid_at" TIMESTAMP(3),
    "reason" TEXT,
    "note" TEXT,
    "created_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_extra_ride_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "route_extra_ride_history_route_daily_plan_id_idx" ON "route_extra_ride_history"("route_daily_plan_id");

-- CreateIndex
CREATE INDEX "route_extra_ride_history_phase_driver_id_idx" ON "route_extra_ride_history"("phase_driver_id");

-- CreateIndex
CREATE INDEX "route_extra_ride_history_route_id_idx" ON "route_extra_ride_history"("route_id");

-- CreateIndex
CREATE INDEX "route_extra_ride_history_created_at_idx" ON "route_extra_ride_history"("created_at");

-- AddForeignKey
ALTER TABLE "route_extra_ride_history" ADD CONSTRAINT "route_extra_ride_history_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_extra_ride_history" ADD CONSTRAINT "route_extra_ride_history_route_daily_plan_id_fkey" FOREIGN KEY ("route_daily_plan_id") REFERENCES "route_daily_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_extra_ride_history" ADD CONSTRAINT "route_extra_ride_history_phase_driver_id_fkey" FOREIGN KEY ("phase_driver_id") REFERENCES "route_daily_plan_phase_drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_extra_ride_history" ADD CONSTRAINT "route_extra_ride_history_previous_driver_id_fkey" FOREIGN KEY ("previous_driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_extra_ride_history" ADD CONSTRAINT "route_extra_ride_history_new_driver_id_fkey" FOREIGN KEY ("new_driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
