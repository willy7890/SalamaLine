import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditModule } from './audit/audit.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { AppLoggerModule } from './common/logging/logger.module';
import { AppConfigModule } from './config/config.module';
import { GatewaysModule } from './gateways/gateways.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { KvModule } from './infrastructure/redis/kv.module';
import { JobsModule } from './jobs/jobs.module';
import { DistrictsModule } from './modules/districts/districts.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

/** Background process: escalation, notification outbox delivery, retention. No HTTP server. */
@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    ScheduleModule.forRoot(),
    PrismaModule,
    KvModule,
    CryptoModule,
    AuditModule,
    GatewaysModule,
    NotificationsModule,
    DistrictsModule,
    JobsModule,
  ],
})
export class WorkerModule {}
