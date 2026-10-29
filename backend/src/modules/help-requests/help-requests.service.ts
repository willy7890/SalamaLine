import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Channel, ConsentDecision, ConsentPurpose, HelpRequest, HelpRequestKind, HelpRequestPriority, HelpRequestStatus, Topic } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';
import { PhoneHashService } from '../../common/crypto/phone-hash.service';
import { AuthUser } from '../../common/types/auth-user';
import { Lang } from '../../common/types/intent';
import { normalizePhone } from '../../common/utils/phone';
import { isUniqueViolation } from '../../infrastructure/prisma/prisma-errors';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AlertService } from './alert.service';
import { generateCaseCode } from './case-code';
import { CreateReferralDto } from './dto/create-referral.dto';

export const CONSENT_WORDING_VERSION = 'salama-consent-v1';
export const MAX_OPEN_REQUESTS_PER_CONTACT = 3;

const OPEN_STATUSES: HelpRequestStatus[] = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'REFERRED'];
const TRANSITIONS: Record<HelpRequestStatus, HelpRequestStatus[]> = {
  PENDING: ['CANCELLED'],
  ACCEPTED: ['IN_PROGRESS', 'REFERRED', 'CLOSED', 'CANCELLED'],
  IN_PROGRESS: ['REFERRED', 'CLOSED', 'CANCELLED'],
  REFERRED: ['IN_PROGRESS', 'CLOSED', 'CANCELLED'],
  CLOSED: [],
  CANCELLED: [],
};

export interface CreateRequestInput {
  kind: HelpRequestKind;
  topic: Topic;
  districtCode: string;
  channel: Channel;
  language: Lang;
  priority?: HelpRequestPriority;
  /** E.164 number; only with consent. */
  contact?: string | null;
  consent: boolean;
  idempotencyKey?: string;
}

export const wipeContactData = () => ({ contactEnc: null, contactHash: null, consentToContact: false, contactWipedAt: new Date() });

@Injectable()
export class HelpRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: FieldEncryptionService,
    private readonly hashes: PhoneHashService,
    private readonly alerts: AlertService,
    private readonly audit: AuditService,
  ) {}

  // ───────────── creation (public / channels) ─────────────

  async create(input: CreateRequestInput) {
    let contact: string | null = null;
    if (input.kind === 'THIRD_PARTY_REPORT') {
      if (input.contact || input.consent) throw new BadRequestException('Reports are anonymous: no contact is accepted');
    } else {
      if (input.consent && !input.contact) throw new BadRequestException('A contact number is required when consent to contact is granted');
      if (input.contact && !input.consent) throw new BadRequestException('Do not submit contact details without explicit consent');
      if (input.contact) {
        contact = normalizePhone(input.contact);
        if (!contact) throw new BadRequestException('Contact number is not valid');
      }
    }

    const contactHash = contact ? this.hashes.hash(contact) : null;
    if (contactHash) {
      const open = await this.prisma.helpRequest.count({ where: { contactHash, status: { in: OPEN_STATUSES } } });
      if (open >= MAX_OPEN_REQUESTS_PER_CONTACT) {
        throw new HttpException('Too many open requests for this number', HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    const id = randomUUID();
    const base = {
      id,
      kind: input.kind,
      topic: input.topic,
      districtCode: input.districtCode,
      channel: input.channel,
      language: input.language,
      priority: input.priority ?? HelpRequestPriority.NORMAL,
      consentToContact: input.consent,
      contactHash,
      contactEnc: contact ? this.crypto.encrypt(contact, `help-request:${id}`) : null,
      idempotencyKey: input.idempotencyKey,
      ...(input.kind === 'SELF_HELP'
        ? {
            consents: {
              create: [
                {
                  purpose: ConsentPurpose.CONTACT_FOR_HELP,
                  decision: input.consent ? ConsentDecision.GRANTED : ConsentDecision.DECLINED,
                  wordingVersion: CONSENT_WORDING_VERSION,
                  channel: input.channel,
                },
              ],
            },
          }
        : {}),
    };

    let created: HelpRequest | null = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      try {
        created = await this.prisma.helpRequest.create({ data: { ...base, caseCode: generateCaseCode() } });
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
        if (input.idempotencyKey) {
          const existing = await this.prisma.helpRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
          if (existing) return this.publicView(existing);
        }
        // otherwise: case code collision, retry with a new code
      }
    }
    if (!created) throw new ConflictException('Could not allocate a case code');

    await this.alerts.alert(created, 'initial');
    await this.prisma.helpRequest.update({ where: { id: created.id }, data: { lastAlertAt: new Date() } });
    await this.audit.record({ action: 'HELP_REQUEST_CREATED', resourceType: 'HelpRequest', resourceId: created.id, outcome: 'SUCCESS' });
    return this.publicView(created);
  }

  private publicView(r: HelpRequest) {
    return {
      caseCode: r.caseCode,
      status: r.status,
      topic: r.topic,
      districtCode: r.districtCode,
      message: 'Request recorded. A trained responder will review it. This service does not contact police, family or authorities by itself.',
    };
  }

  // ───────────── staff access ─────────────

  private assertDistrictAccess(user: AuthUser, districtCode: string) {
    if (user.role === 'ADMIN') return;
    if (!user.districtCode || user.districtCode !== districtCode) throw new ForbiddenException('Not allowed for this district');
  }

  /** After a case is accepted only its assignee, the district focal person or an admin may act on it. */
  private assertCanManage(user: AuthUser, r: HelpRequest) {
    this.assertDistrictAccess(user, r.districtCode);
    if (user.role === 'ADMIN' || user.role === 'DISTRICT_FOCAL') return;
    if (r.assignedResponderId !== user.id) throw new ForbiddenException('Only the assigned responder can act on this case');
  }

  private async getOrThrow(id: string) {
    const r = await this.prisma.helpRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Help request not found');
    return r;
  }

  async listForStaff(user: AuthUser, districtFilter?: string) {
    let district: string | undefined;
    if (user.role === 'ADMIN') district = districtFilter?.toUpperCase();
    else {
      if (!user.districtCode) throw new ForbiddenException('No district assigned to this account');
      district = user.districtCode;
    }
    return this.prisma.helpRequest.findMany({
      where: { ...(district ? { districtCode: district } : {}), status: { in: OPEN_STATUSES } },
      select: { id: true, caseCode: true, kind: true, topic: true, districtCode: true, channel: true, status: true, priority: true, assignedResponderId: true, createdAt: true, escalationCount: true, escalatedAt: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 200,
    });
  }

  /** Atomic first-responder-wins accept. Used by the HTTP route and by the SMS "ACK <code>" reply. */
  async acceptByCaseCode(user: AuthUser, caseCode: string) {
    const r = await this.prisma.helpRequest.findUnique({ where: { caseCode } });
    if (!r) throw new NotFoundException('Help request not found');
    this.assertDistrictAccess(user, r.districtCode);
    const claim = await this.prisma.helpRequest.updateMany({
      where: { id: r.id, status: 'PENDING' },
      data: { status: 'ACCEPTED', acceptedAt: new Date(), assignedResponderId: user.id },
    });
    if (claim.count !== 1) throw new ConflictException('Case is no longer pending');
    // Everyone else no longer needs the alert.
    await this.prisma.notification.deleteMany({ where: { helpRequestId: r.id, status: 'QUEUED', kind: { in: ['RESPONDER_ALERT', 'ESCALATION'] } } });
    await this.audit.record({ actorUserId: user.id, action: 'HELP_REQUEST_ACCEPTED', resourceType: 'HelpRequest', resourceId: r.id, outcome: 'SUCCESS' });
    return { id: r.id, caseCode: r.caseCode, status: 'ACCEPTED' as const, topic: r.topic, districtCode: r.districtCode, hasContact: !!r.contactEnc };
  }

  async accept(user: AuthUser, id: string) {
    const r = await this.getOrThrow(id);
    return this.acceptByCaseCode(user, r.caseCode);
  }

  async updateStatus(user: AuthUser, id: string, status: HelpRequestStatus) {
    const r = await this.getOrThrow(id);
    if (r.status === 'PENDING') {
      this.assertDistrictAccess(user, r.districtCode);
      if (user.role !== 'ADMIN' && user.role !== 'DISTRICT_FOCAL') throw new ForbiddenException('Accept the case first');
    } else this.assertCanManage(user, r);
    if (!TRANSITIONS[r.status].includes(status)) throw new BadRequestException(`Cannot change status from ${r.status} to ${status}`);
    return this.applyStatus(user, r, status);
  }

  /** CLOSE reply by SMS (assignee only). */
  async closeByCaseCode(user: AuthUser, caseCode: string) {
    const r = await this.prisma.helpRequest.findUnique({ where: { caseCode } });
    if (!r) throw new NotFoundException('Help request not found');
    this.assertCanManage(user, r);
    if (!TRANSITIONS[r.status].includes('CLOSED')) throw new BadRequestException('Case cannot be closed from its current status');
    return this.applyStatus(user, r, 'CLOSED');
  }

  private async applyStatus(user: AuthUser, r: HelpRequest, status: HelpRequestStatus) {
    const terminal = status === 'CLOSED' || status === 'CANCELLED';
    const updated = await this.prisma.helpRequest.update({
      where: { id: r.id },
      data: { status, ...(terminal ? { closedAt: new Date(), ...wipeContactData() } : {}) },
      select: { id: true, caseCode: true, status: true, assignedResponderId: true, acceptedAt: true, closedAt: true },
    });
    if (terminal) await this.prisma.notification.deleteMany({ where: { helpRequestId: r.id, status: 'QUEUED' } });
    await this.audit.record({ actorUserId: user.id, action: `HELP_REQUEST_${status}`, resourceType: 'HelpRequest', resourceId: r.id, outcome: 'SUCCESS' });
    return updated;
  }

  /** The girl's number is revealed only to the assigned responder (or district focal person), only with consent, and every read is audited. */
  async revealContact(user: AuthUser, id: string) {
    const r = await this.getOrThrow(id);
    if (user.role === 'ADMIN') throw new ForbiddenException('Administrators cannot read contact numbers');
    this.assertCanManage(user, r);
    if (!r.consentToContact || !r.contactEnc || r.status === 'PENDING' || r.status === 'CLOSED' || r.status === 'CANCELLED') {
      await this.audit.record({ actorUserId: user.id, action: 'CONTACT_REVEAL', resourceType: 'HelpRequest', resourceId: r.id, outcome: 'DENIED' });
      throw new NotFoundException('No contact number available for this case');
    }
    const contact = this.crypto.decrypt(r.contactEnc, `help-request:${r.id}`);
    await this.audit.record({ actorUserId: user.id, action: 'CONTACT_REVEAL', resourceType: 'HelpRequest', resourceId: r.id, outcome: 'SUCCESS' });
    return { caseCode: r.caseCode, contact, safetyReminder: 'Confirm it is safe to talk. Do not contact the family without a safety plan.' };
  }

  async addReferral(user: AuthUser, id: string, dto: CreateReferralDto) {
    const r = await this.getOrThrow(id);
    this.assertCanManage(user, r);
    if (r.status === 'PENDING' || r.status === 'CLOSED' || r.status === 'CANCELLED') throw new BadRequestException('Case is not in a state that allows referrals');
    if (dto.serviceEntryId) {
      const svc = await this.prisma.serviceDirectoryEntry.findFirst({ where: { id: dto.serviceEntryId, isActive: true, expiresAt: { gt: new Date() } } });
      if (!svc) throw new NotFoundException('Verified service not found');
    }
    const referral = await this.prisma.referral.create({
      data: { helpRequestId: r.id, serviceEntryId: dto.serviceEntryId, consentGranted: dto.consentGranted ?? false },
      select: { id: true, serviceEntryId: true, status: true, consentGranted: true, createdAt: true },
    });
    await this.audit.record({ actorUserId: user.id, action: 'REFERRAL_CREATED', resourceType: 'HelpRequest', resourceId: r.id, outcome: 'SUCCESS' });
    return referral;
  }
}
