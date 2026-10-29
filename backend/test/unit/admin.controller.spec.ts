import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { JwtAuthGuard } from '../../src/auth/jwt-auth.guard';
import { AuditService } from '../../src/audit/audit.service';
import { FieldEncryptionService } from '../../src/common/crypto/field-encryption.service';
import { PhoneHashService } from '../../src/common/crypto/phone-hash.service';
import { ENV } from '../../src/config/config.module';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { AdminController } from '../../src/modules/admin/admin.controller';
import { testEnv } from '../helpers';

describe('AdminController user access', () => {
  let app: INestApplication;
  const env = testEnv();
  const prisma = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    district: { findUnique: jest.fn() },
  };
  const audit = { record: jest.fn() };
  const actors: Record<string, { id: string; email: string; role: UserRole; districtCode: null }> = {
    'super-token': { id: 'a0', email: 'super@example.org', role: 'ADMIN', districtCode: null },
    'admin-token': { id: 'a1', email: 'admin@example.org', role: 'ADMIN', districtCode: null },
    'responder-token': { id: 'r1', email: 'resp@example.org', role: 'RESPONDER', districtCode: null },
  };
  const fakeGuard = {
    canActivate: (ctx: { switchToHttp: () => { getRequest: () => { headers: Record<string, string>; user?: unknown } } }) => {
      const req = ctx.switchToHttp().getRequest();
      const actor = actors[(req.headers.authorization ?? '').replace('Bearer ', '')];
      if (!actor) return false;
      req.user = actor;
      return true;
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: ENV, useValue: env },
        FieldEncryptionService,
        PhoneHashService,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(fakeGuard)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });
  afterAll(() => app.close());

  beforeEach(() => {
    prisma.user.findUnique.mockReset().mockResolvedValue({ email: 'responder@example.org', role: UserRole.RESPONDER });
    prisma.user.update.mockReset().mockResolvedValue({ id: 'u1', email: 'responder@example.org', role: UserRole.RESPONDER, isActive: true });
    prisma.district.findUnique.mockReset().mockResolvedValue({ code: 'KYELA' });
    audit.record.mockClear();
  });

  const patch = (token: string | null, body: object) => {
    const r = request(app.getHttpServer()).patch('/api/v1/admin/users/u1/access');
    return (token ? r.set('Authorization', `Bearer ${token}`) : r).send(body);
  };

  it('rejects unauthenticated and non-admin callers', async () => {
    await patch(null, { isActive: true }).expect(403);
    await patch('responder-token', { isActive: true }).expect(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('an ordinary admin can activate a responder and assign a district', async () => {
    await patch('admin-token', { isActive: true, districtCode: 'kyela' }).expect(200);
    expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({ isActive: true, districtCode: 'KYELA' });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_ACCESS_CHANGE', outcome: 'SUCCESS' }));
  });

  it('rejects an unknown district', async () => {
    prisma.district.findUnique.mockResolvedValue(null);
    await patch('admin-token', { isActive: true, districtCode: 'ATLANTIS' }).expect(400);
  });

  it('only the super administrator can grant ADMIN', async () => {
    await patch('admin-token', { isActive: true, role: 'ADMIN' }).expect(403);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'DENIED' }));
    await patch('super-token', { isActive: true, role: 'ADMIN' }).expect(200);
  });

  it('an ordinary admin cannot change another administrator', async () => {
    prisma.user.findUnique.mockResolvedValue({ email: 'other-admin@example.org', role: UserRole.ADMIN });
    await patch('admin-token', { isActive: false }).expect(403);
  });

  it('nobody can deactivate or downgrade the super administrator', async () => {
    prisma.user.findUnique.mockResolvedValue({ email: 'super@example.org', role: UserRole.ADMIN });
    await patch('super-token', { isActive: false }).expect(403);
    await patch('super-token', { isActive: true, role: 'RESPONDER' }).expect(403);
  });

  it('stores a staff phone encrypted plus a keyed hash, never in clear', async () => {
    await patch('admin-token', { isActive: true, phone: '0712345678' }).expect(200);
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(JSON.stringify(data)).not.toContain('712345678');
    expect(data.phoneHash).toMatch(/^[0-9a-f]{64}$/);
    expect(data.phoneEnc).toMatch(/^v1\./);
  });

  it('rejects invalid phone numbers and unknown body fields', async () => {
    await patch('admin-token', { isActive: true, phone: 'call me' }).expect(400);
    await patch('admin-token', { isActive: true, isSuperUser: true }).expect(400);
  });
});
