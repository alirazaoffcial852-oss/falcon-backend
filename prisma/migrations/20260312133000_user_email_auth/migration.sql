-- Rename users.username to users.email for email-based auth
ALTER TABLE "users" RENAME COLUMN "username" TO "email";

-- Rename unique index created by baseline migration
ALTER INDEX "users_username_key" RENAME TO "users_email_key";
