-- AlterTable
ALTER TABLE "route_daily_plan_phase_drivers" ADD COLUMN "availability_missed_at" TIMESTAMP(3),
ADD COLUMN "availability_miss_notified_at" TIMESTAMP(3),
ADD COLUMN "availability_admin_override_until" TIMESTAMP(3);
