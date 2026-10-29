import { BadRequestException, ConflictException, ForbiddenException, HttpException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FieldEncryptionService } from '../../src/common/crypto/field-encryption.service';
import { PhoneHashService } from '../../src/common/crypto/phone-hash.service';
import { AuthUser } from '../../src/common/types/auth-user';
import { HelpRequestsService } from '../../src/modules/help-requests/help-requests.service';
import { generateCaseCode, normaliseCaseCode } from '../../src/modules/help-requests/case-code';
import { testEnv } from '../helpers';

const env = testEnv();
const crypto = new FieldEncryptionService(env);
const hashes = new PhoneHashService(env);

const user = (over: Partial<AuthUser> = {}): AuthUser => ({ id: 'u1', email: 'r@example.org', role: 'RESPONDER', districtCode: 'KYELA', ...over });

function setup() {
  const prisma = {
    helpRequest: { count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    notification: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    referral: { create: jest.fn() },
    serviceDirectoryEntry: { findFirst: jest.fn() },
  };
  prisma.helpRequest.create.mockImplementation(async ({ data }) => ({ ...data, status: 'PENDING', caseCode: data.caseCode }));
  const alerts = { alert: jest.fn().mockResolvedValue(1) };
  const audit = { record: jest.fn() };
  const svc = new HelpRequestsService(prisma as never, crypto, hashes, alerts as never, audit as never);
  return { prisma, alerts, audit, svc };
}

const base = { kind: 'SELF_HELP', topic: 'CHILD_MARRIAGE', districtCode: 'KYELA', channel: 'SMS', language: 'sw' } as const;

describe('HelpRequestsService.create', () => {
  it('stores the callback number encrypted + keyed hash, never in clear, and alerts responders', async () => {
    const { svc, prisma, alerts } = setup();
    const res = await svc.create({ ...base, contact: '0712345678', consent: true });
    const data = prisma.helpRequest.create.mock.calls[0][0].data;
    expect(JSON.stringify(data)).not.toContain('712345678');
    expect(data.contactHash).toMatch(/^[0-9a-f]{64}$/);
    expect(crypto.decrypt(data.contactEnc, `help-request:${data.id}`)).toBe('+255712345678');
    expect(data.consents.create[0]).toMatchObject({ purpose: 'CONTACT_FOR_HELP', decision: 'GRANTED' });
    expect(alerts.alert).toHaveBeenCalledWith(expect.objectContaining({ districtCode: 'KYELA' }), 'initial');
    expect(prisma.helpRequest.update).toHaveBeenCalledWith(expect.objectContaining({ data: { lastAlertAt: expect.any(Date) } }));
    expect(res.caseCode).toMatch(/^SL-[A-Z2-9]{6}$/);
  });

  it('refuses consent without a number, and a number without consent', async () => {
    const { svc } = setup();
    await expect(svc.create({ ...base, consent: true })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.create({ ...base, contact: '0712345678', consent: false })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.create({ ...base, contact: 'abc', consent: true })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('anonymous reports never accept or store a number', async () => {
    const { svc, prisma } = setup();
    await expect(svc.create({ ...base, kind: 'THIRD_PARTY_REPORT', contact: '0712345678', consent: false })).rejects.toBeInstanceOf(BadRequestException);
    await svc.create({ ...base, kind: 'THIRD_PARTY_REPORT', consent: false });
    const data = prisma.helpRequest.create.mock.calls[0][0].data;
    expect(data.contactEnc).toBeNull();
    expect(data.contactHash).toBeNull();
    expect(data.consents).toBeUndefined();
  });

  it('limits open requests per number', async () => {
    const { svc, prisma } = setup();
    prisma.helpRequest.count.mockResolvedValue(3);
    await expect(svc.create({ ...base, contact: '0712345678', consent: true })).rejects.toBeInstanceOf(HttpException);
  });

  it('a retried gateway callback returns the existing case instead of creating a second one', async () => {
    const { svc, prisma, alerts } = setup();
    prisma.helpRequest.create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }));
    prisma.helpRequest.findUnique.mockResolvedValue({ caseCode: 'SL-EXIST2', status: 'PENDING', topic: 'FGM', districtCode: 'KYELA' });
    const res = await svc.create({ ...base, contact: '0712345678', consent: true, idempotencyKey: 'ussd:abc:help' });
    expect(res.caseCode).toBe('SL-EXIST2');
    expect(alerts.alert).not.toHaveBeenCalled();
  });
});

describe('HelpRequestsService staff access', () => {
  const pending = { id: 'r1', caseCode: 'SL-AAAAAA', districtCode: 'KYELA', status: 'PENDING', assignedResponderId: null, consentToContact: true, contactEnc: null };

  it('a responder with no district sees nothing (no cross-district leak)', async () => {
    const { svc } = setup();
    await expect(svc.listForStaff(user({ districtCode: null }))).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('a responder is scoped to their district even if they ask for another', async () => {
    const { svc, prisma } = setup();
    await svc.listForStaff(user(), 'MBEYA_CITY');
    expect(prisma.helpRequest.findMany.mock.calls[0][0].where.districtCode).toBe('KYELA');
  });

  it('accept: first responder wins, other districts are refused, losers get a conflict', async () => {
    const { svc, prisma } = setup();
    prisma.helpRequest.findUnique.mockResolvedValue(pending);
    await expect(svc.acceptByCaseCode(user({ districtCode: 'CHUNYA' }), 'SL-AAAAAA')).rejects.toBeInstanceOf(ForbiddenException);
    prisma.helpRequest.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(svc.acceptByCaseCode(user(), 'SL-AAAAAA')).rejects.toBeInstanceOf(ConflictException);
    prisma.helpRequest.updateMany.mockResolvedValueOnce({ count: 1 });
    await expect(svc.acceptByCaseCode(user(), 'SL-AAAAAA')).resolves.toMatchObject({ status: 'ACCEPTED' });
    expect(prisma.notification.deleteMany).toHaveBeenCalled(); // other responders' queued alerts are cancelled
  });

  describe('revealContact', () => {
    const accepted = () => ({ ...pending, status: 'ACCEPTED', assignedResponderId: 'u1', contactEnc: crypto.encrypt('+255712345678', 'help-request:r1') });

    it('only the assigned responder may read the number, and the read is audited', async () => {
      const { svc, prisma, audit } = setup();
      prisma.helpRequest.findUnique.mockResolvedValue(accepted());
      await expect(svc.revealContact(user({ id: 'other' }), 'r1')).rejects.toBeInstanceOf(ForbiddenException);
      await expect(svc.revealContact(user(), 'r1')).resolves.toMatchObject({ contact: '+255712345678' });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'CONTACT_REVEAL', outcome: 'SUCCESS' }));
    });
    it('administrators cannot read numbers', async () => {
      const { svc, prisma } = setup();
      prisma.helpRequest.findUnique.mockResolvedValue(accepted());
      await expect(svc.revealContact(user({ role: 'ADMIN', districtCode: null }), 'r1')).rejects.toBeInstanceOf(ForbiddenException);
    });
    it('is unavailable without consent or once closed', async () => {
      const { svc, prisma } = setup();
      prisma.helpRequest.findUnique.mockResolvedValue({ ...accepted(), consentToContact: false });
      await expect(svc.revealContact(user(), 'r1')).rejects.toBeInstanceOf(NotFoundException);
      prisma.helpRequest.findUnique.mockResolvedValue({ ...accepted(), status: 'CLOSED' });
      await expect(svc.revealContact(user(), 'r1')).rejects.toBeInstanceOf(NotFoundException);
    });
    it('cannot be moved to another row (ciphertext is bound to the case id)', async () => {
      const { svc, prisma } = setup();
      prisma.helpRequest.findUnique.mockResolvedValue({ ...accepted(), id: 'r2' });
      await expect(svc.revealContact(user(), 'r2')).rejects.toThrow();
    });
  });

  describe('updateStatus', () => {
    it('closing wipes the contact and cancels queued messages', async () => {
      const { svc, prisma } = setup();
      prisma.helpRequest.findUnique.mockResolvedValue({ ...pending, status: 'IN_PROGRESS', assignedResponderId: 'u1' });
      prisma.helpRequest.update.mockResolvedValue({});
      await svc.updateStatus(user(), 'r1', 'CLOSED');
      expect(prisma.helpRequest.update.mock.calls[0][0].data).toMatchObject({ status: 'CLOSED', contactEnc: null, contactHash: null, consentToContact: false });
      expect(prisma.notification.deleteMany).toHaveBeenCalled();
    });
    it('enforces valid transitions and assignee-only changes', async () => {
      const { svc, prisma } = setup();
      prisma.helpRequest.findUnique.mockResolvedValue({ ...pending, status: 'CLOSED', assignedResponderId: 'u1' });
      await expect(svc.updateStatus(user(), 'r1', 'IN_PROGRESS')).rejects.toBeInstanceOf(BadRequestException);
      prisma.helpRequest.findUnique.mockResolvedValue({ ...pending, status: 'ACCEPTED', assignedResponderId: 'someone-else' });
      await expect(svc.updateStatus(user(), 'r1', 'CLOSED')).rejects.toBeInstanceOf(ForbiddenException);
      prisma.helpRequest.findUnique.mockResolvedValue(pending);
      await expect(svc.updateStatus(user(), 'r1', 'CANCELLED')).rejects.toBeInstanceOf(ForbiddenException); // pending: accept first
    });
  });
});

describe('case codes', () => {
  it('are unambiguous, readable and parseable', () => {
    for (let i = 0; i < 200; i++) expect(generateCaseCode()).toMatch(/^SL-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    expect(normaliseCaseCode('sl-abc234')).toBe('SL-ABC234');
    expect(normaliseCaseCode('SLABC234')).toBe('SL-ABC234');
    expect(normaliseCaseCode('nope')).toBeNull();
  });
});
