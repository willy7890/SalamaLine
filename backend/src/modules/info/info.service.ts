import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, Topic, UserRole } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { AuthUser } from '../../common/types/auth-user';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateContentDto, ReviewContentDto } from './dto/content.dto';

const PUBLIC_SELECT = { id: true, slug: true, title: true, language: true, topic: true, shortText: true, fullText: true, sourceName: true, sourceUrl: true, reviewedAt: true } as const;

@Injectable()
export class InfoService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  /** The only content that can ever reach a girl: APPROVED, reviewed, and not past its review date. */
  private servable(language: string, topic?: Topic) {
    return { status: ContentStatus.APPROVED, language, ...(topic ? { topic } : {}), reviewerId: { not: null }, OR: [{ reviewDueAt: null }, { reviewDueAt: { gt: new Date() } }] };
  }

  list(language = 'sw', topic?: Topic) {
    return this.prisma.content.findMany({ where: this.servable(language, topic), select: PUBLIC_SELECT, orderBy: { publishedAt: 'desc' } });
  }

  /** Falls back to the other language if there is no approved text in the requested one. */
  async getForTopic(topic: Topic, language: string) {
    const find = (lang: string) => this.prisma.content.findFirst({ where: this.servable(lang, topic), select: PUBLIC_SELECT, orderBy: { publishedAt: 'desc' } });
    return (await find(language)) ?? (await find(language === 'sw' ? 'en' : 'sw'));
  }

  listForReviewers(status?: ContentStatus) {
    return this.prisma.content.findMany({ where: status ? { status } : {}, orderBy: { updatedAt: 'desc' }, take: 200 });
  }

  async create(dto: CreateContentDto, author: AuthUser) {
    const created = await this.prisma.content.create({ data: { ...dto, status: ContentStatus.DRAFT, authorId: author.id } });
    await this.audit.record({ actorUserId: author.id, action: 'CONTENT_CREATED', resourceType: 'Content', resourceId: created.id, outcome: 'SUCCESS' });
    return created;
  }

  async review(id: string, reviewer: AuthUser, dto: ReviewContentDto) {
    if (reviewer.role !== UserRole.ADMIN && reviewer.role !== UserRole.CONTENT_REVIEWER) throw new ForbiddenException();
    const content = await this.prisma.content.findUnique({ where: { id } });
    if (!content) throw new NotFoundException('Content not found');
    // Four-eyes rule: nobody approves their own text.
    if (dto.approve && content.authorId === reviewer.id) {
      await this.audit.record({ actorUserId: reviewer.id, action: 'CONTENT_REVIEW', resourceType: 'Content', resourceId: id, outcome: 'DENIED' });
      throw new ForbiddenException('Content must be approved by someone other than its author');
    }
    const now = new Date();
    const due = dto.reviewDueAt ?? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    const updated = await this.prisma.content.update({
      where: { id },
      data: {
        status: dto.approve ? ContentStatus.APPROVED : ContentStatus.DRAFT,
        reviewerId: reviewer.id,
        reviewedAt: now,
        reviewNotes: dto.notes,
        publishedAt: dto.approve ? now : null,
        reviewDueAt: dto.approve ? due : null,
      },
    });
    await this.audit.record({ actorUserId: reviewer.id, action: dto.approve ? 'CONTENT_APPROVED' : 'CONTENT_RETURNED', resourceType: 'Content', resourceId: id, outcome: 'SUCCESS' });
    return updated;
  }
}
