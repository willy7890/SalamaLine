import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/types/auth-user';
import { DistrictsService } from '../districts/districts.service';
import { BadRequestException } from '@nestjs/common';
import { CreateHelpRequestDto, CreateReportDto } from './dto/create-help-request.dto';
import { CreateReferralDto } from './dto/create-referral.dto';
import { UpdateHelpRequestStatusDto } from './dto/update-help-request-status.dto';
import { HelpRequestsService } from './help-requests.service';

@ApiTags('help-requests')
@Controller('help-requests')
export class HelpRequestsController {
  constructor(private readonly service: HelpRequestsService, private readonly districts: DistrictsService) {}

  private async districtOrThrow(input: string) {
    const d = await this.districts.resolve(input);
    if (!d) throw new BadRequestException('Unknown district');
    return d.code;
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  async create(@Body() dto: CreateHelpRequestDto) {
    return this.service.create({
      kind: 'SELF_HELP',
      topic: dto.topic,
      districtCode: await this.districtOrThrow(dto.district),
      channel: 'WEB', // the public API can only ever be the web channel; USSD/SMS/WhatsApp arrive through their own webhooks
      language: 'sw',
      priority: dto.priority,
      contact: dto.contact,
      consent: dto.consentToContact,
    });
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reports')
  async report(@Body() dto: CreateReportDto) {
    return this.service.create({
      kind: 'THIRD_PARTY_REPORT',
      topic: dto.topic,
      districtCode: await this.districtOrThrow(dto.district),
      channel: 'WEB',
      language: 'sw',
      consent: false,
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DISTRICT_FOCAL', 'RESPONDER')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query('district') district?: string) {
    return this.service.listForStaff(user, district);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRICT_FOCAL', 'RESPONDER')
  @HttpCode(200)
  @Post(':id/accept')
  accept(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.accept(user, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRICT_FOCAL', 'RESPONDER')
  @Get(':id/contact')
  contact(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.revealContact(user, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DISTRICT_FOCAL', 'RESPONDER')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: UpdateHelpRequestStatusDto, @CurrentUser() user: AuthUser) {
    return this.service.updateStatus(user, id, body.status);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRICT_FOCAL', 'RESPONDER')
  @Post(':id/referrals')
  referral(@Param('id') id: string, @Body() dto: CreateReferralDto, @CurrentUser() user: AuthUser) {
    return this.service.addReferral(user, id, dto);
  }
}
