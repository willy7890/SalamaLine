import { Inject, Injectable } from '@nestjs/common';
import { ENV, Env } from '../../config/config.module';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface Cell {
  key: string;
  count: number;
}

/** Drops any cell below the threshold so small groups cannot identify an individual. Enforced here, not in the frontend. */
export function suppress<T extends { count: number }>(rows: T[], threshold: number): T[] {
  return rows.filter((r) => r.count >= threshold);
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService, @Inject(ENV) private readonly env: Env) {}

  async summary(from?: Date, to?: Date) {
    const t = this.env.SMALL_COUNT_THRESHOLD;
    const createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    const where = Object.keys(createdAt).length ? { createdAt } : {};

    const [byTopic, byDistrict, byChannel, total, answered] = await Promise.all([
      this.prisma.helpRequest.groupBy({ by: ['topic'], where, _count: { _all: true } }),
      this.prisma.helpRequest.groupBy({ by: ['districtCode'], where, _count: { _all: true } }),
      this.prisma.helpRequest.groupBy({ by: ['channel'], where, _count: { _all: true } }),
      this.prisma.helpRequest.count({ where }),
      this.prisma.helpRequest.findMany({ where: { ...where, acceptedAt: { not: null } }, select: { districtCode: true, createdAt: true, acceptedAt: true }, take: 5000 }),
    ]);

    const perDistrict = new Map<string, number[]>();
    for (const r of answered) {
      const minutes = (r.acceptedAt!.getTime() - r.createdAt.getTime()) / 60_000;
      perDistrict.set(r.districtCode, [...(perDistrict.get(r.districtCode) ?? []), minutes]);
    }
    const responseMinutes = suppress(
      [...perDistrict.entries()].map(([key, v]) => ({ key, count: v.length, medianMinutes: Math.round(median(v) * 10) / 10 })),
      t,
    );

    const metrics = await this.prisma.anonymousMetric.groupBy({
      by: ['metricKey', 'districtCode', 'channel'],
      where: { ...(from || to ? { bucketDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) },
      _sum: { count: true },
    });

    return {
      smallCountThreshold: t,
      helpRequests: {
        total: total >= t ? total : null,
        byTopic: suppress(byTopic.map((r) => ({ key: r.topic, count: r._count._all })), t),
        byDistrict: suppress(byDistrict.map((r) => ({ key: r.districtCode, count: r._count._all })), t),
        byChannel: suppress(byChannel.map((r) => ({ key: r.channel, count: r._count._all })), t),
        medianMinutesToAccept: responseMinutes,
      },
      usage: suppress(metrics.map((m) => ({ metric: m.metricKey, districtCode: m.districtCode, channel: m.channel, count: m._sum.count ?? 0 })), t),
    };
  }
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
