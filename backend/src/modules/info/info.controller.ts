import { Body, Controller, Get, Param, ParseEnumPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ContentStatus, Topic } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/types/auth-user';
import { CreateContentDto, ReviewContentDto } from './dto/content.dto';
import { InfoService } from './info.service';

@ApiTags('approved-content')
@Controller('content')
export class InfoController {
  constructor(private readonly service: InfoService) {}

  @Get()
  list(@Query('language') language = 'sw', @Query('topic', new ParseEnumPipe(Topic, { optional: true })) topic?: Topic) {
    return this.service.list(language, topic);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'CONTENT_REVIEWER')
  @Get('admin/all')
  listAll(@Query('status', new ParseEnumPipe(ContentStatus, { optional: true })) status?: ContentStatus) {
    return this.service.listForReviewers(status);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'CONTENT_REVIEWER')
  @Post()
  create(@Body() dto: CreateContentDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'CONTENT_REVIEWER')
  @Post(':id/review')
  review(@Param('id') id: string, @Body() body: ReviewContentDto, @CurrentUser() user: AuthUser) {
    return this.service.review(id, user, body);
  }
}
