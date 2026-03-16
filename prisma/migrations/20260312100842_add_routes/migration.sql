-- CreateEnum
CREATE TYPE "RouteStatus" AS ENUM ('PENDING', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "routes" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "driver_id" INTEGER NOT NULL,
    "office_address" TEXT NOT NULL,
    "office_lat" DOUBLE PRECISION NOT NULL,
    "office_long" DOUBLE PRECISION NOT NULL,
    "status" "RouteStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_legs" (
    "id" SERIAL NOT NULL,
    "route_id" INTEGER NOT NULL,
    "passenger_id" INTEGER NOT NULL,
    "pickup_address" TEXT NOT NULL,
    "pickup_lat" DOUBLE PRECISION NOT NULL,
    "pickup_long" DOUBLE PRECISION NOT NULL,
    "pickup_time" TEXT NOT NULL,
    "pickup_status" "RouteStatus" NOT NULL DEFAULT 'PENDING',
    "dropoff_address" TEXT NOT NULL,
    "dropoff_lat" DOUBLE PRECISION NOT NULL,
    "dropoff_long" DOUBLE PRECISION NOT NULL,
    "dropoff_time" TEXT NOT NULL,
    "dropoff_status" "RouteStatus" NOT NULL DEFAULT 'PENDING',
    "toll_amount" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_legs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_legs" ADD CONSTRAINT "route_legs_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_legs" ADD CONSTRAINT "route_legs_passenger_id_fkey" FOREIGN KEY ("passenger_id") REFERENCES "passengers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
