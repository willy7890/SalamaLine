import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ChannelsModule } from './channels/channels.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { I18nModule } from './common/i18n/i18n.module';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { AppLoggerModule } from './common/logging/logger.module';
import { AppConfigModule } from './config/config.module';
import { GatewaysModule } from './gateways/gateways.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { KvModule } from './infrastructure/redis/kv.module';
import { KV_STORE, KvStore } from './infrastructure/redis/kv-store';
import { KvThrottlerStorage } from './infrastructure/redis/kv-throttler.storage';
import { AdminModule } from './modules/admin/admin.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DirectoryModule } from './modules/directory/directory.module';
import { DistrictsModule } from './modules/districts/districts.module';
import { HelpRequestsModule } from './modules/help-requests/help-requests.module';
import { InfoModule } from './modules/info/info.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { RespondersModule } from './modules/responders/responders.module';
import { WellbeingModule } from './modules/wellbeing/wellbeing.module';

/** The HTTP API. Scheduled jobs (escalation, outbox retries, retention) run in the separate worker process. */
@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    // Rate limits are shared across instances when REDIS_URL is set (required in production).
    ThrottlerModule.forRootAsync({
      imports: [KvModule],
      inject: [KV_STORE],
      useFactory: (kv: KvStore) => ({ throttlers: [{ ttl: 60_000, limit: 60 }], storage: new KvThrottlerStorage(kv) }),
    }),
    PrismaModule,
    KvModule,
    CryptoModule,
    AuditModule,
    IdempotencyModule,
    I18nModule,
    GatewaysModule,
    NotificationsModule,
    AuthModule,
    DistrictsModule,
    DashboardModule,
    PrivacyModule,
    InfoModule,
    DirectoryModule,
    HelpRequestsModule,
    RespondersModule,
    WellbeingModule,
    ChannelsModule,
    AdminModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
