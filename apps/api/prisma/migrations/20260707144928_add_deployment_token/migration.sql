-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "deploy_token_hash" TEXT;

-- CreateIndex
CREATE INDEX "deployments_project_id_environment_commit_sha_idx" ON "deployments"("project_id", "environment", "commit_sha");
