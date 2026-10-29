import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, Env } from '../config/config.module';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { wipeContactData } from '../modules/help-requests/help-requests.service';

const DAY_MS = 24 * 60 * 60_000;

/** Data minimisation: nothing identifying outlives its purpose, even if a case is forgotten open. */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger('Retention');
  constructor(private readonly prisma: PrismaService, @Inject(ENV) private readonly env: Env) {}

  async runOnce(now = new Date()) {
    const contactCutoff = new Date(now.getTime() - this.env.CONTACT_MAX_RETENTION_DAYS * DAY_MS);
    const weekAgo = new Date(now.getTime() - 7 * DAY_MS);

    // 1. Callback numbers on finished cases (defence in depth: closing already wipes) or older than the retention limit.
    const contacts = await this.prisma.helpRequest.updateMany({
      where: {
        OR: [{ contactEnc: { not: null } }, { contactHash: { not: null } }],
        AND: [{ OR: [{ status: { in: ['CLOSED', 'CANCELLED'] } }, { createdAt: { lt: contactCutoff } }] }],
      },
      data: wipeContactData(),
    });
    // 2. Delivered/failed notifications and webhook ids are only needed briefly.
    const notifications = await this.prisma.notification.deleteMany({ where: { status: { in: ['SENT', 'FAILED'] }, createdAt: { lt: weekAgo } } });
    const webhooks = await this.prisma.processedWebhook.deleteMany({ where: { createdAt: { lt: weekAgo } } });
    // 3. Any queued recipient number older than a day is abandoned.
    const stale = await this.prisma.notification.updateMany({ where: { status: 'QUEUED', createdAt: { lt: new Date(now.getTime() - DAY_MS) } }, data: { status: 'FAILED', recipientEnc: null, lastError: 'Expired in queue' } });

    // 4. Audit events are metadata only, but still not kept forever.
    const audit = await this.prisma.auditEvent.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - this.env.AUDIT_RETENTION_DAYS * DAY_MS) } } });

    const result = { contactsWiped: contacts.count, notificationsDeleted: notifications.count, webhooksDeleted: webhooks.count, staleNotifications: stale.count, auditDeleted: audit.count };
    this.logger.log(`Retention pass: ${JSON.stringify(result)}`);
    return result;
  }
}
