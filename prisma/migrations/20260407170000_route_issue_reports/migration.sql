CREATE TABLE "route_issue_reports" (
    "id" SERIAL NOT NULL,
    "route_id" INTEGER NOT NULL,
    "driver_id" INTEGER NOT NULL,
    "image_url" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_issue_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "route_issue_reports_route_id_created_at_idx"
    ON "route_issue_reports"("route_id", "created_at");

CREATE INDEX "route_issue_reports_driver_id_created_at_idx"
    ON "route_issue_reports"("driver_id", "created_at");

ALTER TABLE "route_issue_reports"
    ADD CONSTRAINT "route_issue_reports_route_id_fkey"
    FOREIGN KEY ("route_id") REFERENCES "routes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "route_issue_reports"
    ADD CONSTRAINT "route_issue_reports_driver_id_fkey"
    FOREIGN KEY ("driver_id") REFERENCES "drivers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
