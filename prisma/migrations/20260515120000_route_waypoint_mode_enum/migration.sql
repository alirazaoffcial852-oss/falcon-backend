-- Pickup/drop ordering mode for route definitions (auto vs manual).
CREATE TYPE "WaypointMode" AS ENUM ('auto', 'manual');

ALTER TABLE "routes" ADD COLUMN "waypoint_mode" "WaypointMode" NOT NULL DEFAULT 'auto';
