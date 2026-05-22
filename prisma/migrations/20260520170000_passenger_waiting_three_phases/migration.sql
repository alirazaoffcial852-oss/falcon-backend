-- Three-step waiting notifications (still waiting → skip → move next).
ALTER TABLE "route_daily_plan_phase_passengers" ADD COLUMN IF NOT EXISTS "still_waiting_phase_notified_at" TIMESTAMP(3);
ALTER TABLE "route_daily_plan_phase_passengers" ADD COLUMN IF NOT EXISTS "skip_phase_notified_at" TIMESTAMP(3);
ALTER TABLE "route_daily_plan_phase_passengers" ADD COLUMN IF NOT EXISTS "move_next_notified_at" TIMESTAMP(3);
