-- Drop duplicated Route-level directions cache columns.
-- Directions are already stored on RouteBatch (pickup/drop) and derived for mobile at runtime.

ALTER TABLE "routes" DROP COLUMN IF EXISTS "directions_polyline";
ALTER TABLE "routes" DROP COLUMN IF EXISTS "directions_waypoint_order";
ALTER TABLE "routes" DROP COLUMN IF EXISTS "directions_legs";
ALTER TABLE "routes" DROP COLUMN IF EXISTS "directions_distance_meters";
ALTER TABLE "routes" DROP COLUMN IF EXISTS "directions_duration_seconds";
ALTER TABLE "routes" DROP COLUMN IF EXISTS "directions_updated_at";

