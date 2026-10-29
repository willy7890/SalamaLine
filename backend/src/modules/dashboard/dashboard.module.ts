import { Global, Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { MetricsService } from './metrics.service';

@Global()
@Module({ controllers: [DashboardController], providers: [DashboardService, MetricsService], exports: [MetricsService, DashboardService] })
export class DashboardModule {}
