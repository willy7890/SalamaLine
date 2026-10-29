import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ENV, Env } from '../config/config.module';
import { MESSAGE_GATEWAYS, MessageGateway } from '../gateways/message-gateway';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { KV_STORE, KvStore } from '../infrastructure/redis/kv-store';

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(KV_STORE) private readonly kv: KvStore,
    @Inject(MESSAGE_GATEWAYS) private readonly gateways: MessageGateway[],
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get()
  live() {
    return { status: 'ok', service: 'salamaline-api', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async ready() {
    const database = await this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    const kv = await this.kv.ping();
    const channels = {
      sms: this.gateways.find((g) => g.channel === 'SMS')?.provider ?? 'disabled',
      whatsapp: this.gateways.find((g) => g.channel === 'WHATSAPP')?.provider ?? 'disabled',
    };
    const body = { status: database && kv ? 'ready' : 'degraded', database, store: this.kv.kind, storeOk: kv, channels, env: this.env.NODE_ENV };
    if (!database || !kv) throw new ServiceUnavailableException(body);
    return body;
  }
}
