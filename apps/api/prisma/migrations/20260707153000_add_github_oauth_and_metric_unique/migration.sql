-- AlterTable
ALTER TABLE "users" ADD COLUMN     "github_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "metric_snapshots_project_id_period_start_period_end_key" ON "metric_snapshots"("project_id", "period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "users_github_id_key" ON "users"("github_id");

