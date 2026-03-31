-- CreateEnum
CREATE TYPE "SegmentKind" AS ENUM ('PICKUP_TO_OFFICE', 'DROP_TO_HOMES');

-- CreateEnum
CREATE TYPE "SegmentStatus" AS ENUM ('PENDING', 'ONGOING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DropoffStatus" AS ENUM ('PENDING', 'ARRIVED', 'DROPPED', 'SKIPPED');

-- AlterTable drivers
ALTER TABLE "drivers" ADD COLUMN "home_lat" DOUBLE PRECISION,
ADD COLUMN "home_long" DOUBLE PRECISION;

-- CreateTable route_batches (before legs reference batch_id as NOT NULL)
CREATE TABLE "route_batches" (
    "id" SERIAL NOT NULL,
    "route_id" INTEGER NOT NULL,
    "batch_order" INTEGER NOT NULL,
    "pickup_directions_polyline" TEXT,
    "pickup_waypoint_order" JSONB,
    "pickup_directions_legs" JSONB,
    "pickup_distance_meters" INTEGER,
    "pickup_duration_seconds" INTEGER,
    "pickup_updated_at" TIMESTAMP(3),
    "drop_directions_polyline" TEXT,
    "drop_waypoint_order" JSONB,
    "drop_directions_legs" JSONB,
    "drop_distance_meters" INTEGER,
    "drop_duration_seconds" INTEGER,
    "drop_updated_at" TIMESTAMP(3),

    CONSTRAINT "route_batches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "route_batches_route_id_batch_order_key" ON "route_batches"("route_id", "batch_order");

ALTER TABLE "route_batches" ADD CONSTRAINT "route_batches_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Alter route_legs: add nullable batch_id and new columns first
ALTER TABLE "route_legs" ADD COLUMN "batch_id" INTEGER,
ADD COLUMN "drop_sequence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "dropoff_arrived_at" TIMESTAMP(3),
ADD COLUMN "dropoff_status" "DropoffStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "dropped_at" TIMESTAMP(3);

-- Backfill: one batch per existing route
INSERT INTO "route_batches" ("route_id", "batch_order")
SELECT "id", 1 FROM "routes";

UPDATE "route_legs" rl
SET "batch_id" = rb."id"
FROM "route_batches" rb
WHERE rb."route_id" = rl."route_id" AND rb."batch_order" = 1;

ALTER TABLE "route_legs" ALTER COLUMN "batch_id" SET NOT NULL;

ALTER TABLE "route_legs" ADD CONSTRAINT "route_legs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "route_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable route_segments
CREATE TABLE "route_segments" (
    "id" SERIAL NOT NULL,
    "route_id" INTEGER NOT NULL,
    "segment_order" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "kind" "SegmentKind" NOT NULL,
    "status" "SegmentStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "route_segments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "route_segments_route_id_segment_order_key" ON "route_segments"("route_id", "segment_order");

ALTER TABLE "route_segments" ADD CONSTRAINT "route_segments_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "route_segments" ADD CONSTRAINT "route_segments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "route_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill segments: for each batch, pickup then drop (segment_order 0 and 1)
INSERT INTO "route_segments" ("route_id", "segment_order", "batch_id", "kind", "status")
SELECT rb."route_id", 0, rb."id", 'PICKUP_TO_OFFICE', 'PENDING'
FROM "route_batches" rb;

INSERT INTO "route_segments" ("route_id", "segment_order", "batch_id", "kind", "status")
SELECT rb."route_id", 1, rb."id", 'DROP_TO_HOMES', 'PENDING'
FROM "route_batches" rb;

-- Copy cached pickup directions from legacy routes row into the single batch per route
UPDATE "route_batches" rb
SET
  "pickup_directions_polyline" = r."directions_polyline",
  "pickup_waypoint_order" = r."directions_waypoint_order",
  "pickup_directions_legs" = r."directions_legs",
  "pickup_distance_meters" = r."directions_distance_meters",
  "pickup_duration_seconds" = r."directions_duration_seconds",
  "pickup_updated_at" = r."directions_updated_at"
FROM "routes" r
WHERE r."id" = rb."route_id";
