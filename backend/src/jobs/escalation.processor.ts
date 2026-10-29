import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EscalationService } from '../modules/help-requests/escalation.service';

@Injectable()
export class EscalationProcessor {
  private readonly logger = new Logger('EscalationJob');
  private running = false;
  constructor(private readonly escalation: EscalationService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.escalation.runOnce();
    } catch {
      this.logger.error('Escalation pass failed; will retry next minute');
    } finally {
      this.running = false;
    }
  }
}
