import { Injectable } from '@nestjs/common';
import { isUniqueViolation } from '../../infrastructure/prisma/prisma-errors';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/** Gateways retry webhooks. `once()` returns true the first time it sees an id and false on every repeat. */
@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async once(provider: string, externalId: string): Promise<boolean> {
    try {
      await this.prisma.processedWebhook.create({ data: { provider, externalId } });
      return true;
    } catch (e) {
      if (isUniqueViolation(e)) return false;
      throw e;
    }
  }

  /** Un-marks an id after a processing failure so the provider's retry is processed instead of dropped. */
  async forget(provider: string, externalId: string): Promise<void> {
    await this.prisma.processedWebhook.deleteMany({ where: { provider, externalId } });
  }
}
