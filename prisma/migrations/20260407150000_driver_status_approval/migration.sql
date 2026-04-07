CREATE TYPE "DriverApprovalStatus" AS ENUM ('PENDING', 'APPROVED');

ALTER TABLE "drivers"
ADD COLUMN "status" "DriverApprovalStatus" NOT NULL DEFAULT 'APPROVED';
