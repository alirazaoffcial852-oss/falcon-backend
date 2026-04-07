CREATE TABLE "driver_create_requests" (
    "id" SERIAL NOT NULL,
    "requested_by_user_id" INTEGER,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewed_by_user_id" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_driver_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_create_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "driver_create_requests_status_created_at_idx"
    ON "driver_create_requests"("status", "created_at");

ALTER TABLE "driver_create_requests"
    ADD CONSTRAINT "driver_create_requests_requested_by_user_id_fkey"
    FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "driver_create_requests"
    ADD CONSTRAINT "driver_create_requests_reviewed_by_user_id_fkey"
    FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "driver_create_requests"
    ADD CONSTRAINT "driver_create_requests_created_driver_id_fkey"
    FOREIGN KEY ("created_driver_id") REFERENCES "drivers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
