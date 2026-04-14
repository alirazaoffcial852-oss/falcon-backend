CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID');

ALTER TABLE "route_daily_plan_phase_drivers"
ADD COLUMN "salary_payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN "fuel_payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN "salary_paid_at" TIMESTAMP(3),
ADD COLUMN "fuel_paid_at" TIMESTAMP(3);
