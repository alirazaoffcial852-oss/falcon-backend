-- Backfill unique route names for existing rows, then enforce NOT NULL + UNIQUE.
ALTER TABLE "routes" ADD COLUMN "route_name" TEXT;

UPDATE "routes"
SET "route_name" = 'RO' || LPAD(id::text, 4, '0')
WHERE "route_name" IS NULL;

ALTER TABLE "routes" ALTER COLUMN "route_name" SET NOT NULL;

CREATE UNIQUE INDEX "routes_route_name_key" ON "routes"("route_name");
