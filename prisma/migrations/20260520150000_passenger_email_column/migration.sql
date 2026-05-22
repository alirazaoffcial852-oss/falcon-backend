-- Restore passengers.email when DB drifted (schema expects optional email).
ALTER TABLE "passengers" ADD COLUMN IF NOT EXISTS "email" TEXT;
