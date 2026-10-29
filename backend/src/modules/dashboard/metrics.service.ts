import { Injectable, Logger } from '@nestjs/common';
import { Channel } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/** Anonymous counters only: (metric, district, channel, day) -> count. Never stores who did what. */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger('Metrics');
  constructor(private readonly prisma: PrismaService) {}

  static today(now = new Date()): Date {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  /** Fire-and-forget safe: metrics must never break a request for help. */
  async increment(metricKey: string, opts: { channel: Channel; districtCode?: string }): Promise<void> {
    const districtCode = opts.districtCode ?? 'ALL';
    const bucketDate = MetricsService.today();
    try {
      await this.prisma.anonymousMetric.upsert({
        where: { metricKey_districtCode_channel_bucketDate: { metricKey, districtCode, channel: opts.channel, bucketDate } },
        create: { metricKey, districtCode, channel: opts.channel, bucketDate, count: 1 },
        update: { count: { increment: 1 } },
      });
    } catch {
      this.logger.warn(`Metric ${metricKey} not recorded`);
    }
  }
}
