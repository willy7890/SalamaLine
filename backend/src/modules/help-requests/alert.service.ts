import { Injectable, Logger } from '@nestjs/common';
import { HelpRequestPriority, Topic, UserRole } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export type AlertMode = 'initial' | 'reminder' | 'escalation';

export interface AlertTarget {
  id: string;
  caseCode: string;
  topic: Topic;
  districtCode: string;
  priority: HelpRequestPriority;
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger('Alerts');

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: FieldEncryptionService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  private async staffWithPhone(roles: UserRole[], districtCode?: string) {
    return this.prisma.user.findMany({
      where: { role: { in: roles }, isActive: true, phoneEnc: { not: null }, ...(districtCode ? { districtCode } : {}) },
      select: { id: true, phoneEnc: true },
    });
  }

  /** Responders first, then the district focal person, then administrators. A case is never left with nobody to tell. */
  async pickRecipients(mode: AlertMode, districtCode: string) {
    const order: Array<[UserRole[], string | undefined]> =
      mode === 'escalation'
        ? [[['DISTRICT_FOCAL'], districtCode], [['ADMIN'], undefined]]
        : [[['RESPONDER'], districtCode], [['DISTRICT_FOCAL'], districtCode], [['ADMIN'], undefined]];
    for (const [roles, district] of order) {
      const staff = await this.staffWithPhone(roles, district);
      if (staff.length > 0) return staff;
    }
    return [];
  }

  buildBody(target: AlertTarget, mode: AlertMode): string {
    const urgent = target.priority === 'URGENT' ? ' URGENT' : '';
    const prefix = mode === 'initial' ? 'New case' : mode === 'reminder' ? 'REMINDER: case' : 'ESCALATION, no response: case';
    return `SalamaLine: ${prefix} ${target.caseCode} (${target.topic}) ${target.districtCode}${urgent}. Reply ACK ${target.caseCode} to accept.`;
  }

  /** Queues one SMS per recipient. Returns how many were queued (0 is audited and logged as an error). */
  async alert(target: AlertTarget, mode: AlertMode): Promise<number> {
    const recipients = await this.pickRecipients(mode, target.districtCode);
    const body = this.buildBody(target, mode);
    let queued = 0;
    for (const staff of recipients) {
      try {
        const to = this.crypto.decrypt(staff.phoneEnc!, `user-phone:${staff.id}`);
        await this.notifications.enqueueAndKick({
          kind: mode === 'escalation' ? 'ESCALATION' : 'RESPONDER_ALERT',
          channel: 'SMS',
          to,
          body,
          helpRequestId: target.id,
        });
        queued += 1;
      } catch {
        this.logger.error(`Could not queue alert for staff ${staff.id}`);
      }
    }
    if (queued === 0) {
      this.logger.error(`NO RECIPIENTS for case ${target.caseCode} in ${target.districtCode}: needs manual attention`);
      await this.audit.record({ action: 'ALERT_NO_RECIPIENTS', resourceType: 'HelpRequest', resourceId: target.id, outcome: 'FAILURE' });
    }
    return queued;
  }
}
