import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import { MemoryKvStore } from '../../src/infrastructure/redis/memory-kv.store';
import { KvThrottlerStorage } from '../../src/infrastructure/redis/kv-throttler.storage';
import { RetentionService } from '../../src/jobs/retention.service';
import { testEnv } from '../helpers';

const ctxFor = (user: unknown) => ({ getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as unknown as ExecutionContext;
const reflector = (roles?: string[]) => ({ getAllAndOverride: () => roles }) as never;

describe('RolesGuard', () => {
  it('denies by default when a route forgot @Roles()', () => {
    expect(() => new RolesGuard(reflector(undefined), testEnv()).canActivate(ctxFor({ role: 'ADMIN' }))).toThrow(ForbiddenException);
  });
  it('checks the role', () => {
    const guard = new RolesGuard(reflector(['ADMIN']), testEnv());
    expect(guard.canActivate(ctxFor({ role: 'ADMIN' }))).toBe(true);
    expect(() => guard.canActivate(ctxFor({ role: 'RESPONDER' }))).toThrow(ForbiddenException);
  });
  it('requires a 2FA session when REQUIRE_MFA_STAFF is on, and not otherwise', () => {
    const on = new RolesGuard(reflector(['RESPONDER']), testEnv({ REQUIRE_MFA_STAFF: 'true' }));
    expect(() => on.canActivate(ctxFor({ role: 'RESPONDER', mfa: false }))).toThrow(/Two-factor/);
    expect(on.canActivate(ctxFor({ role: 'RESPONDER', mfa: true }))).toBe(true);
    const off = new RolesGuard(reflector(['RESPONDER']), testEnv({ REQUIRE_MFA_STAFF: 'false' }));
    expect(off.canActivate(ctxFor({ role: 'RESPONDER', mfa: false }))).toBe(true);
  });
});

describe('production 2FA policy', () => {
  const prod = { NODE_ENV: 'production', REDIS_URL: 'redis://x', SMS_PROVIDER: 'africastalking', AT_USERNAME: 'u', AT_API_KEY: 'k', WEBHOOK_SHARED_SECRET: 'w'.repeat(30), HELPLINE_NUMBER: '116' };
  it('is on by default in production, off in development, and cannot be disabled in production', () => {
    expect(testEnv(prod).REQUIRE_MFA_STAFF).toBe(true);
    expect(testEnv().REQUIRE_MFA_STAFF).toBe(false);
    expect(() => testEnv({ ...prod, REQUIRE_MFA_STAFF: 'false' })).toThrow(/REQUIRE_MFA_STAFF/);
  });
});

describe('KvThrottlerStorage', () => {
  it('counts per key, blocks after the limit and keeps keys independent', async () => {
    const storage = new KvThrottlerStorage(new MemoryKvStore());
    const hit = (key: string) => storage.increment(key, 60_000, 3, 0, 'default');
    expect(await hit('ip1')).toMatchObject({ totalHits: 1, isBlocked: false });
    await hit('ip1');
    await hit('ip1');
    expect(await hit('ip1')).toMatchObject({ totalHits: 4, isBlocked: true });
    expect(await hit('ip2')).toMatchObject({ totalHits: 1, isBlocked: false });
  });
});

describe('RetentionService', () => {
  const NOW = new Date('2026-10-24T10:00:00Z');
  function setup() {
    const prisma = {
      helpRequest: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      notification: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      processedWebhook: { deleteMany: jest.fn().mockResolvedValue({ count: 4 }) },
      auditEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 5 }) },
    };
    return { prisma, svc: new RetentionService(prisma as never, testEnv({ CONTACT_MAX_RETENTION_DAYS: '30', AUDIT_RETENTION_DAYS: '730' })) };
  }
  it('wipes contacts on finished or over-age cases and nothing else on the case', async () => {
    const { svc, prisma } = setup();
    await svc.runOnce(NOW);
    const call = prisma.helpRequest.updateMany.mock.calls[0][0];
    expect(call.data).toMatchObject({ contactEnc: null, contactHash: null, consentToContact: false });
    expect(call.data.status).toBeUndefined();
    expect(JSON.stringify(call.where)).toContain('CLOSED');
    expect(JSON.stringify(call.where)).toContain(new Date('2026-09-24T10:00:00Z').toISOString());
  });
  it('purges old outbox rows, webhook ids and audit events by their own cut-offs', async () => {
    const { svc, prisma } = setup();
    const res = await svc.runOnce(NOW);
    expect(prisma.processedWebhook.deleteMany.mock.calls[0][0].where.createdAt.lt).toEqual(new Date('2026-10-17T10:00:00Z'));
    expect(prisma.auditEvent.deleteMany.mock.calls[0][0].where.createdAt.lt).toEqual(new Date(NOW.getTime() - 730 * 86_400_000));
    expect(res).toEqual({ contactsWiped: 2, notificationsDeleted: 3, webhooksDeleted: 4, staleNotifications: 1, auditDeleted: 5 });
  });
});
