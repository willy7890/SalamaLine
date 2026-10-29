import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../infrastructure/prisma/prisma.service';

export interface AuditInput {
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome: 'SUCCESS' | 'DENIED' | 'FAILURE';
  requestId?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Metadata only: never message text, names, contact numbers, tokens or case narratives.
   * Audit failures must not break the user-facing operation, but they are logged loudly.
   */
  async record(input: AuditInput): Promise<void> {
    try {
      await this.prisma.auditEvent.create({
        data: {
          actorUserId: input.actorUserId ?? null,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId ?? null,
          outcome: input.outcome,
          requestId: input.requestId ?? null,
        },
      });
    } catch {
      this.logger.error(`Audit write failed for action ${input.action}`);
    }
  }
}
