import type { UserRole } from 'shared';
import { db, activityLogs } from '../db/index.js';

export interface RecordAuditLogInput {
  userId?: string | null;
  userEmail: string;
  userRole: UserRole;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  status?: 'success' | 'failed';
}

export async function recordActivityLog(input: RecordAuditLogInput): Promise<void> {
  try {
    await db.insert(activityLogs).values({
      userId: input.userId ?? null,
      userEmail: input.userEmail,
      userRole: input.userRole,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? {},
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      status: input.status ?? 'success',
    });
  } catch (err) {
    console.error('[AuditService] Failed to write activity log:', err);
  }
}
