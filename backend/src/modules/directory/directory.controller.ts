import { Body, Controller, Get, HttpCode, Param, ParseEnumPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ServiceType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/types/auth-user';
import { DistrictsService } from '../districts/districts.service';
import { DirectoryService } from './directory.service';
import { CreateServiceEntryDto } from './dto/service-entry.dto';

@ApiTags('verified-service-directory')
@Controller('services')
export class DirectoryController {
  constructor(private readonly service: DirectoryService, private readonly districts: DistrictsService) {}

  @Get()
  async list(@Query('district') district?: string, @Query('type', new ParseEnumPipe(ServiceType, { optional: true })) type?: ServiceType) {
    const resolved = district ? await this.districts.resolve(district) : null;
    if (district && !resolved) return [];
    return this.service.list(resolved?.code, type);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateServiceEntryDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(200)
  @Post(':id/activate')
  activate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.setActive(id, true, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(200)
  @Post(':id/deactivate')
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.setActive(id, false, user);
  }
}
