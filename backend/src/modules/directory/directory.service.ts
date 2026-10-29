import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ServiceType } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { AuthUser } from '../../common/types/auth-user';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DistrictsService } from '../districts/districts.service';
import { CreateServiceEntryDto } from './dto/service-entry.dto';

const PUBLIC_SELECT = { id: true, name: true, type: true, districtCode: true, phonePublic: true, address: true, openingHours: true, languages: true, verificationOrg: true, verifiedAt: true, expiresAt: true } as const;

@Injectable()
export class DirectoryService {
  constructor(private readonly prisma: PrismaService, private readonly districts: DistrictsService, private readonly audit: AuditService) {}

  /** Only active, partner-verified, unexpired entries are ever shown. */
  list(districtCode?: string, type?: ServiceType, take = 100) {
    const now = new Date();
    return this.prisma.serviceDirectoryEntry.findMany({
      where: { isActive: true, verifiedAt: { lte: now }, expiresAt: { gt: now }, ...(districtCode ? { districtCode } : {}), ...(type ? { type } : {}) },
      select: PUBLIC_SELECT,
      orderBy: [{ districtCode: 'asc' }, { name: 'asc' }],
      take,
    });
  }

  async formatForSms(districtCode: string, lang: 'sw' | 'en', types?: ServiceType[], max = 4): Promise<string[]> {
    const rows = (await this.list(districtCode)).filter((r) => !types || types.includes(r.type)).slice(0, max);
    return rows.map((r) => `${r.name}${r.phonePublic ? ` ${r.phonePublic}` : ''}${r.openingHours ? ` (${r.openingHours})` : ''}`);
  }

  async create(dto: CreateServiceEntryDto, actor: AuthUser) {
    const district = await this.districts.resolve(dto.district);
    if (!district) throw new BadRequestException('Unknown district');
    if (dto.verifiedAt.getTime() > Date.now()) throw new BadRequestException('verifiedAt cannot be in the future');
    const expiresAt = dto.expiresAt ?? new Date(dto.verifiedAt.getFullYear() + 1, dto.verifiedAt.getMonth(), dto.verifiedAt.getDate());
    const { district: _d, ...rest } = dto;
    const created = await this.prisma.serviceDirectoryEntry.create({
      data: { ...rest, districtCode: district.code, region: district.region, expiresAt, languages: dto.languages ?? [], isActive: false },
    });
    await this.audit.record({ actorUserId: actor.id, action: 'SERVICE_CREATED', resourceType: 'ServiceDirectoryEntry', resourceId: created.id, outcome: 'SUCCESS' });
    return created;
  }

  async setActive(id: string, isActive: boolean, actor: AuthUser) {
    const entry = await this.prisma.serviceDirectoryEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Service not found');
    if (isActive && (!entry.expiresAt || entry.expiresAt <= new Date())) throw new BadRequestException('Verification has expired; re-verify before activating');
    const updated = await this.prisma.serviceDirectoryEntry.update({ where: { id }, data: { isActive }, select: PUBLIC_SELECT });
    await this.audit.record({ actorUserId: actor.id, action: isActive ? 'SERVICE_ACTIVATED' : 'SERVICE_DEACTIVATED', resourceType: 'ServiceDirectoryEntry', resourceId: id, outcome: 'SUCCESS' });
    return updated;
  }
}
