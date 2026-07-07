import type { Prisma } from "../../../generated/prisma";
import { prisma } from "../../lib/prisma";

interface RecordAuditEventInput {
  action: string;
  entityType: string;
  entityId?: string;
  actorId?: string;
  workspaceId?: string;
  projectId?: string;
  metadata?: Prisma.InputJsonValue;
}

export async function recordAuditEvent(input: RecordAuditEventInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorId: input.actorId,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      metadata: input.metadata ?? {},
    },
  });
}
