import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Post, UseGuards, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AuditService } from '../../audit/audit.service';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';
import { PhoneHashService } from '../../common/crypto/phone-hash.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/types/auth-user';
import { normalizePhone } from '../../common/utils/phone';
import { toCode } from '../../common/utils/text';
import { ENV, Env } from '../../config/config.module';
import { isUniqueViolation } from '../../infrastructure/prisma/prisma-errors';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateDistrictDto, UpdateUserAccessDto } from './dto/admin.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly crypto: FieldEncryptionService,
    private readonly hashes: PhoneHashService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private isSuper(email: string) {
    return email.trim().toLowerCase() === this.env.SUPER_ADMIN_EMAIL;
  }

  @Get('users')
  users() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, displayName: true, role: true, districtCode: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Patch('users/:id/access')
  @ApiOperation({ summary: 'Activate/deactivate a user, set role, district and alert phone. Only the super administrator can grant ADMIN or change an administrator.' })
  async access(@Param('id') id: string, @Body() body: UpdateUserAccessDto, @CurrentUser() actor: AuthUser) {
    const superAdmin = this.isSuper(actor.email);
    const target = await this.prisma.user.findUnique({ where: { id }, select: { email: true, role: true } });
    if (!target) throw new NotFoundException('User not found');

    const deny = async (message: string) => {
      await this.audit.record({ actorUserId: actor.id, action: 'USER_ACCESS_CHANGE', resourceType: 'User', resourceId: id, outcome: 'DENIED' });
      throw new ForbiddenException(message);
    };
    if (!superAdmin && (target.role === 'ADMIN' || this.isSuper(target.email))) await deny('Only the super administrator can change administrator access');
    if (body.role === 'ADMIN' && !superAdmin) await deny('Only the super administrator can grant administrator access');
    if (this.isSuper(target.email) && (body.isActive === false || (body.role && body.role !== 'ADMIN'))) await deny('The super administrator account cannot be deactivated or downgraded');

    let districtCode: string | null | undefined;
    if (body.districtCode !== undefined) {
      if (body.districtCode === '') districtCode = null;
      else {
        const d = await this.prisma.district.findUnique({ where: { code: toCode(body.districtCode) } });
        if (!d) throw new BadRequestException('Unknown district');
        districtCode = d.code;
      }
    }

    let phone: { phoneEnc: string | null; phoneHash: string | null } | undefined;
    if (body.phone !== undefined) {
      if (body.phone === '') phone = { phoneEnc: null, phoneHash: null };
      else {
        const normalised = normalizePhone(body.phone);
        if (!normalised) throw new BadRequestException('Phone number is not valid');
        phone = { phoneEnc: this.crypto.encrypt(normalised, `user-phone:${id}`), phoneHash: this.hashes.hash(normalised) };
      }
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id },
        data: { isActive: body.isActive, ...(body.role ? { role: body.role } : {}), ...(districtCode !== undefined ? { districtCode } : {}), ...(phone ?? {}) },
        select: { id: true, email: true, displayName: true, role: true, districtCode: true, isActive: true },
      });
      await this.audit.record({ actorUserId: actor.id, action: 'USER_ACCESS_CHANGE', resourceType: 'User', resourceId: id, outcome: 'SUCCESS' });
      return updated;
    } catch (e) {
      if (isUniqueViolation(e)) throw new BadRequestException('That phone number is already assigned to another account');
      throw e;
    }
  }

  @Patch('users/:id/mfa-reset')
  @ApiOperation({ summary: 'Clear a user\'s 2FA (lost phone). They must enrol again. Only the super administrator can reset an administrator.' })
  async resetMfa(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    const target = await this.prisma.user.findUnique({ where: { id }, select: { email: true, role: true } });
    if (!target) throw new NotFoundException('User not found');
    if (!this.isSuper(actor.email) && (target.role === 'ADMIN' || this.isSuper(target.email))) {
      await this.audit.record({ actorUserId: actor.id, action: 'MFA_RESET', resourceType: 'User', resourceId: id, outcome: 'DENIED' });
      throw new ForbiddenException('Only the super administrator can reset administrator 2FA');
    }
    await this.prisma.user.update({ where: { id }, data: { totpSecretEnc: null, totpEnabledAt: null } });
    await this.audit.record({ actorUserId: actor.id, action: 'MFA_RESET', resourceType: 'User', resourceId: id, outcome: 'SUCCESS' });
    return { message: 'Two-factor authentication cleared. The user must enrol again.' };
  }

  @Post('districts')
  async createDistrict(@Body() dto: CreateDistrictDto, @CurrentUser() actor: AuthUser) {
    try {
      const d = await this.prisma.district.create({ data: dto });
      await this.audit.record({ actorUserId: actor.id, action: 'DISTRICT_CREATED', resourceType: 'District', resourceId: d.code, outcome: 'SUCCESS' });
      return d;
    } catch (e) {
      if (isUniqueViolation(e)) throw new BadRequestException('District already exists');
      throw e;
    }
  }
}
