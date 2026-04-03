-- Copy `passengers.office_pick_up_time` into `route_legs.office_pick_up_time` at route optimize time.
ALTER TABLE "route_legs" ADD COLUMN "office_pick_up_time" TEXT;

