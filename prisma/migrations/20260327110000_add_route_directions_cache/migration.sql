ALTER TABLE "routes"
ADD COLUMN "directions_polyline" TEXT,
ADD COLUMN "directions_waypoint_order" JSONB,
ADD COLUMN "directions_legs" JSONB,
ADD COLUMN "directions_distance_meters" INTEGER,
ADD COLUMN "directions_duration_seconds" INTEGER,
ADD COLUMN "directions_updated_at" TIMESTAMP(3);
