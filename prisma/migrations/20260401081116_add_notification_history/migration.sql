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

-- CreateIndex
CREATE INDEX "notification_histories_user_id_created_at_idx" ON "notification_histories"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "notification_histories" ADD CONSTRAINT "notification_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
