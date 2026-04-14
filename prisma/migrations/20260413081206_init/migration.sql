-- CreateEnum
CREATE TYPE "PhasePassengerStatus" AS ENUM ('PENDING', 'ARRIVED', 'PICKED', 'SKIPPED', 'DROPPED', 'STILL_WAITING', 'MOVE_TO_NEXT');

-- CreateEnum
CREATE TYPE "PassengerAck" AS ENUM ('COMING', 'NOT_COMING');

-- CreateEnum
CREATE TYPE "SegmentKind" AS ENUM ('PICKUP_TO_OFFICE', 'DROP_TO_HOMES');

-- CreateEnum
CREATE TYPE "SegmentStatus" AS ENUM ('PENDING', 'ONGOING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RouteStatus" AS ENUM ('PENDING', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RouteDailyPlanPhase" AS ENUM ('PICKUP', 'DROP');

-- CreateEnum
CREATE TYPE "DriverApprovalStatus" AS ENUM ('PENDING', 'APPROVED');

-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY');

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_admin_role" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_permissions" (
    "id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "module" TEXT NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT false,
    "can_create" BOOLEAN NOT NULL DEFAULT false,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_histories" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_device_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "device_token" TEXT NOT NULL,
    "platform" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone_no" TEXT,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "long" DOUBLE PRECISION,
    "weekly_off_days" "Weekday"[] DEFAULT ARRAY[]::"Weekday"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cars" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "engine_capacity" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "car_no" TEXT NOT NULL,
    "car_color" TEXT NOT NULL,
    "fuel_per_km" TEXT,
    "car_front_image_url" TEXT NOT NULL,
    "car_back_image_url" TEXT NOT NULL,
    "car_front_card_url" TEXT NOT NULL,
    "car_back_card_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "name" TEXT NOT NULL,
    "phone_no" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "emergency_phone_no" TEXT NOT NULL,
    "driver_image_url" TEXT NOT NULL,
    "rate_per_km" DOUBLE PRECISION NOT NULL,
    "driver_cnic_front_url" TEXT NOT NULL,
    "driver_cnic_back_url" TEXT NOT NULL,
    "salary" TEXT NOT NULL,
    "driver_license_front_url" TEXT NOT NULL,
    "driver_license_back_url" TEXT NOT NULL,
    "status" "DriverApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    "is_available" BOOLEAN NOT NULL DEFAULT false,
    "available_at" TIMESTAMP(3),
    "home_lat" DOUBLE PRECISION,
    "home_long" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "driver_assign_cars" (
    "id" SERIAL NOT NULL,
    "driver_id" INTEGER NOT NULL,
    "car_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_assign_cars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passengers" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone_no" TEXT NOT NULL,
    "home_address" TEXT,
    "home_lat" DOUBLE PRECISION,
    "home_long" DOUBLE PRECISION,
    "office_address" TEXT NOT NULL,
    "office_lat" DOUBLE PRECISION,
    "office_long" DOUBLE PRECISION,
    "company_id" INTEGER NOT NULL,
    "pick_up_time" TEXT,
    "drop_off_time" TEXT,
    "office_pick_up_time" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "passengers_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "routes" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "driver_id" INTEGER NOT NULL,
    "office_address" TEXT NOT NULL,
    "office_lat" DOUBLE PRECISION NOT NULL,
    "office_long" DOUBLE PRECISION NOT NULL,
    "recurring_plan_start" DATE,
    "recurring_plan_end" DATE,
    "route_daily_plan_id" INTEGER,
    "route_price" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "route_daily_plans" (
    "id" SERIAL NOT NULL,
    "definition_route_id" INTEGER NOT NULL,
    "scheduled_date" DATE NOT NULL,
    "status" "RouteStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_daily_plans_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
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

-- CreateTable
CREATE TABLE "route_segments" (
    "id" SERIAL NOT NULL,
    "route_id" INTEGER NOT NULL,
    "segment_order" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "kind" "SegmentKind" NOT NULL,
    "status" "SegmentStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "route_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_legs" (
    "id" SERIAL NOT NULL,
    "route_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "passenger_id" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "drop_sequence" INTEGER NOT NULL DEFAULT 0,
    "pickup_address" TEXT NOT NULL,
    "pickup_lat" DOUBLE PRECISION NOT NULL,
    "pickup_long" DOUBLE PRECISION NOT NULL,
    "pickup_time" TEXT NOT NULL,
    "dropoff_address" TEXT NOT NULL,
    "dropoff_lat" DOUBLE PRECISION NOT NULL,
    "dropoff_long" DOUBLE PRECISION NOT NULL,
    "dropoff_time" TEXT NOT NULL,
    "office_pick_up_time" TEXT,
    "toll_amount" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_legs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_daily_plan_phase_drivers" (
    "id" SERIAL NOT NULL,
    "route_daily_plan_id" INTEGER NOT NULL,
    "phase" "RouteDailyPlanPhase" NOT NULL,
    "driver_id" INTEGER NOT NULL,
    "scheduled_date" DATE NOT NULL,
    "trip_start_time" TEXT,
    "trip_started_at" TIMESTAMP(3),
    "status" "RouteStatus" NOT NULL DEFAULT 'PENDING',
    "trip_price" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_daily_plan_phase_drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_daily_plan_phase_passengers" (
    "id" SERIAL NOT NULL,
    "route_daily_plan_phase_driver_id" INTEGER NOT NULL,
    "passenger_id" INTEGER NOT NULL,
    "status" "PhasePassengerStatus" NOT NULL DEFAULT 'PENDING',
    "driver_arrived_at" TIMESTAMP(3),
    "passenger_ack" "PassengerAck",
    "picked_at" TIMESTAMP(3),
    "dropoff_arrived_at" TIMESTAMP(3),
    "dropped_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_daily_plan_phase_passengers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "admin_permissions_role_id_idx" ON "admin_permissions"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_permissions_role_id_module_key" ON "admin_permissions"("role_id", "module");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "notification_histories_user_id_created_at_idx" ON "notification_histories"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_device_tokens_device_token_key" ON "user_device_tokens"("device_token");

-- CreateIndex
CREATE INDEX "user_device_tokens_user_id_is_active_idx" ON "user_device_tokens"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_user_id_key" ON "drivers"("user_id");

-- CreateIndex
CREATE INDEX "driver_create_requests_status_created_at_idx" ON "driver_create_requests"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "passengers_user_id_key" ON "passengers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "routes_route_daily_plan_id_key" ON "routes"("route_daily_plan_id");

-- CreateIndex
CREATE INDEX "routes_driver_id_idx" ON "routes"("driver_id");

-- CreateIndex
CREATE INDEX "route_issue_reports_route_id_created_at_idx" ON "route_issue_reports"("route_id", "created_at");

-- CreateIndex
CREATE INDEX "route_issue_reports_driver_id_created_at_idx" ON "route_issue_reports"("driver_id", "created_at");

-- CreateIndex
CREATE INDEX "route_daily_plans_scheduled_date_idx" ON "route_daily_plans"("scheduled_date");

-- CreateIndex
CREATE UNIQUE INDEX "route_daily_plans_definition_route_id_scheduled_date_key" ON "route_daily_plans"("definition_route_id", "scheduled_date");

-- CreateIndex
CREATE UNIQUE INDEX "company_holidays_company_id_date_key" ON "company_holidays"("company_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "driver_leaves_driver_id_date_key" ON "driver_leaves"("driver_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "route_batches_route_id_batch_order_key" ON "route_batches"("route_id", "batch_order");

-- CreateIndex
CREATE UNIQUE INDEX "route_segments_route_id_segment_order_key" ON "route_segments"("route_id", "segment_order");

-- CreateIndex
CREATE INDEX "route_daily_plan_phase_drivers_driver_id_idx" ON "route_daily_plan_phase_drivers"("driver_id");

-- CreateIndex
CREATE INDEX "route_daily_plan_phase_drivers_driver_id_scheduled_date_idx" ON "route_daily_plan_phase_drivers"("driver_id", "scheduled_date");

-- CreateIndex
CREATE UNIQUE INDEX "route_daily_plan_phase_drivers_route_daily_plan_id_phase_key" ON "route_daily_plan_phase_drivers"("route_daily_plan_id", "phase");

-- AddForeignKey
ALTER TABLE "admin_permissions" ADD CONSTRAINT "admin_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_histories" ADD CONSTRAINT "notification_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_device_tokens" ADD CONSTRAINT "user_device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_create_requests" ADD CONSTRAINT "driver_create_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_create_requests" ADD CONSTRAINT "driver_create_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_create_requests" ADD CONSTRAINT "driver_create_requests_created_driver_id_fkey" FOREIGN KEY ("created_driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_assign_cars" ADD CONSTRAINT "driver_assign_cars_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_assign_cars" ADD CONSTRAINT "driver_assign_cars_car_id_fkey" FOREIGN KEY ("car_id") REFERENCES "cars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passengers" ADD CONSTRAINT "passengers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passengers" ADD CONSTRAINT "passengers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_route_daily_plan_id_fkey" FOREIGN KEY ("route_daily_plan_id") REFERENCES "route_daily_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_issue_reports" ADD CONSTRAINT "route_issue_reports_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_issue_reports" ADD CONSTRAINT "route_issue_reports_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_daily_plans" ADD CONSTRAINT "route_daily_plans_definition_route_id_fkey" FOREIGN KEY ("definition_route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_holidays" ADD CONSTRAINT "company_holidays_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_leaves" ADD CONSTRAINT "driver_leaves_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_batches" ADD CONSTRAINT "route_batches_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_segments" ADD CONSTRAINT "route_segments_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_segments" ADD CONSTRAINT "route_segments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "route_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_legs" ADD CONSTRAINT "route_legs_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_legs" ADD CONSTRAINT "route_legs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "route_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_legs" ADD CONSTRAINT "route_legs_passenger_id_fkey" FOREIGN KEY ("passenger_id") REFERENCES "passengers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_daily_plan_phase_drivers" ADD CONSTRAINT "route_daily_plan_phase_drivers_route_daily_plan_id_fkey" FOREIGN KEY ("route_daily_plan_id") REFERENCES "route_daily_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_daily_plan_phase_drivers" ADD CONSTRAINT "route_daily_plan_phase_drivers_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_daily_plan_phase_passengers" ADD CONSTRAINT "route_daily_plan_phase_passengers_route_daily_plan_phase_d_fkey" FOREIGN KEY ("route_daily_plan_phase_driver_id") REFERENCES "route_daily_plan_phase_drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_daily_plan_phase_passengers" ADD CONSTRAINT "route_daily_plan_phase_passengers_passenger_id_fkey" FOREIGN KEY ("passenger_id") REFERENCES "passengers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
