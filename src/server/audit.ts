import { prisma } from "./db";

export async function writeAudit(input: {
  userId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  meta?: unknown;
  ipAddress?: string | null;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId == null ? null : String(input.entityId),
      meta: input.meta === undefined ? undefined : (input.meta as object),
      ipAddress: input.ipAddress ?? null,
    },
  });
}
