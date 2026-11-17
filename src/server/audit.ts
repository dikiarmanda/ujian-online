import { prisma } from "./db";
import { logError, logEvent } from "./logger";

export async function writeAudit(input: {
  userId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  meta?: unknown;
  ipAddress?: string | null;
}): Promise<void> {
  try {
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
  } catch (error) {
    // Kegagalan audit tidak boleh menggagalkan aksi utama (PRD Logging).
    logError("audit_gagal", {
      userId: input.userId ?? undefined,
      msg: error instanceof Error ? error.message : "gagal menulis audit_log",
      action: input.action,
      entityType: input.entityType,
    });
  }
  // Jejak yang sama juga ditulis ke log file (JSON) untuk debugging/devops.
  logEvent(input.action.toLowerCase(), {
    userId: input.userId ?? undefined,
    ip: input.ipAddress ?? undefined,
    entityType: input.entityType,
    entityId: input.entityId == null ? undefined : String(input.entityId),
    meta: input.meta,
  });
}
