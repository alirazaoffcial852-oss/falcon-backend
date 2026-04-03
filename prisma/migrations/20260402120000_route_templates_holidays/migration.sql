-- AlterTable
ALTER TABLE "routes" ADD COLUMN "is_template" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "routes" ADD COLUMN "source_template_id" INTEGER;
ALTER TABLE "routes" ADD COLUMN "scheduled_date" DATE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_source_template_id_fkey" FOREIGN KEY ("source_template_id") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "routes_driver_id_scheduled_date_idx" ON "routes"("driver_id", "scheduled_date");

-- CreateIndex
CREATE INDEX "routes_source_template_id_scheduled_date_idx" ON "routes"("source_template_id", "scheduled_date");

-- CreateTable
CREATE TABLE "company_holidays" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_leaves" (
    "id" SERIAL NOT NULL,
    "driver_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_leaves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_holidays_company_id_date_key" ON "company_holidays"("company_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "driver_leaves_driver_id_date_key" ON "driver_leaves"("driver_id", "date");

-- AddForeignKey
ALTER TABLE "company_holidays" ADD CONSTRAINT "company_holidays_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_leaves" ADD CONSTRAINT "driver_leaves_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
