-- CreateTable
CREATE TABLE "driver_configurations" (
    "id" SERIAL NOT NULL,
    "availability_time" TEXT NOT NULL,
    "still_waiting_button_appear_in" TEXT NOT NULL,
    "remaining_start_time" TEXT NOT NULL,
    "passenger_waiting_time" TEXT NOT NULL,
    "skip_button_appear_in" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_configurations_pkey" PRIMARY KEY ("id")
);
