import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('partner-dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'PARTNER_ANALYST')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  summary(@Query('from') from?: string, @Query('to') to?: string) {
    const f = from ? new Date(from) : undefined;
    const t = to ? new Date(to) : undefined;
    return this.service.summary(f && !isNaN(+f) ? f : undefined, t && !isNaN(+t) ? t : undefined);
  }
}
