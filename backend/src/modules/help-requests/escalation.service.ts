import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, Env } from '../../config/config.module';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AlertService } from './alert.service';

/**
 * "A trained human is always behind every request." State lives in PostgreSQL (lastAlertAt, escalationCount), so a
 * restart or crash loses nothing. Each due case is claimed with a compare-and-set update, so several workers can run.
 */
@Injectable()
export class EscalationService {
  private readonly logger = new Logger('Escalation');

  constructor(private readonly prisma: PrismaService, private readonly alerts: AlertService, @Inject(ENV) private readonly env: Env) {}

  async runOnce(now = new Date()): Promise<{ examined: number; alerted: number; escalated: number }> {
    const threshold = new Date(now.getTime() - this.env.ESCALATION_REMINDER_MINUTES * 60_000);
    const due = await this.prisma.helpRequest.findMany({
      where: {
        status: 'PENDING',
        OR: [{ lastAlertAt: { lte: threshold } }, { lastAlertAt: null, createdAt: { lte: threshold } }],
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    let alerted = 0;
    let escalated = 0;
    for (const r of due) {
      const reminderNumber = r.escalationCount + 1;
      const escalate = reminderNumber > this.env.ESCALATION_REMINDERS_BEFORE_FOCAL;
      const claim = await this.prisma.helpRequest.updateMany({
        where: { id: r.id, status: 'PENDING', lastAlertAt: r.lastAlertAt },
        data: { lastAlertAt: now, escalationCount: { increment: 1 }, ...(escalate && !r.escalatedAt ? { escalatedAt: now } : {}) },
      });
      if (claim.count !== 1) continue; // another worker took it, or it was accepted meanwhile
      await this.alerts.alert(r, escalate ? 'escalation' : 'reminder');
      alerted += 1;
      if (escalate) escalated += 1;
    }
    if (due.length > 0) this.logger.log(`Escalation pass: ${due.length} due, ${alerted} alerted, ${escalated} escalated`);
    return { examined: due.length, alerted, escalated };
  }
}
