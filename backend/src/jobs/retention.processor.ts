import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RetentionService } from './retention.service';

@Injectable()
export class RetentionProcessor {
  private readonly logger = new Logger('RetentionJob');
  constructor(private readonly retention: RetentionService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async tick() {
    try {
      await this.retention.runOnce();
    } catch {
      this.logger.error('Retention pass failed; will retry next hour');
    }
  }
}
