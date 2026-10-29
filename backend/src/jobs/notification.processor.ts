import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '../modules/notifications/notifications.service';

@Injectable()
export class NotificationProcessor {
  private readonly logger = new Logger('NotificationJob');
  private running = false;
  constructor(private readonly notifications: NotificationsService) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.notifications.processDue();
    } catch {
      this.logger.error('Notification pass failed; will retry');
    } finally {
      this.running = false;
    }
  }
}
