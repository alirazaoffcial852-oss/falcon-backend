-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "description" TEXT,
ADD COLUMN     "is_admin_role" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "route_daily_plan_phase_passengers" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "is_super_admin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "admin_permissions" (
    "id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "module" TEXT NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT false,
    "can_create" BOOLEAN NOT NULL DEFAULT false,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_permissions_role_id_idx" ON "admin_permissions"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_permissions_role_id_module_key" ON "admin_permissions"("role_id", "module");

-- CreateIndex
CREATE INDEX "routes_driver_id_idx" ON "routes"("driver_id");

-- RenameForeignKey
ALTER TABLE "route_daily_plan_phase_passengers" RENAME CONSTRAINT "route_daily_plan_phase_passengers_route_daily_plan_phase_driver" TO "route_daily_plan_phase_passengers_route_daily_plan_phase_d_fkey";

-- AddForeignKey
ALTER TABLE "admin_permissions" ADD CONSTRAINT "admin_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
