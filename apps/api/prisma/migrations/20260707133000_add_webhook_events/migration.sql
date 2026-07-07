-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT,
    "delivery_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_delivery_id_key" ON "webhook_events"("delivery_id");

-- CreateIndex
CREATE INDEX "webhook_events_repository_id_created_at_idx" ON "webhook_events"("repository_id", "created_at");

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "github_repositories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
