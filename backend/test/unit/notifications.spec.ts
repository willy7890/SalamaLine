import { FakeGateway } from '../../src/gateways/fake.gateway';
import { PermanentSendError, TransientSendError } from '../../src/gateways/message-gateway';
import { FieldEncryptionService } from '../../src/common/crypto/field-encryption.service';
import { PhoneHashService } from '../../src/common/crypto/phone-hash.service';
import { backoffMs, MAX_ATTEMPTS, NotificationsService } from '../../src/modules/notifications/notifications.service';
import { testEnv } from '../helpers';

const env = testEnv();
const crypto = new FieldEncryptionService(env);
const hashes = new PhoneHashService(env);
const NOW = new Date('2026-10-24T10:00:00Z');

function setup(gateways: unknown[] = [new FakeGateway('SMS')], row: Record<string, unknown> | null = {}) {
  const store = { id: 'n1', kind: 'RESPONDER_ALERT', channel: 'SMS', body: 'hello', attempts: 0, recipientEnc: crypto.encrypt('+255712345678', 'notification:n1'), ...row };
  const prisma = {
    notification: {
      create: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue(row === null ? null : store),
      update: jest.fn(),
      findMany: jest.fn().mockResolvedValue([{ id: 'n1' }]),
    },
  };
  const audit = { record: jest.fn() };
  return { prisma, audit, svc: new NotificationsService(prisma as never, crypto, hashes, audit as never, gateways as never) };
}

describe('NotificationsService', () => {
  it('enqueue encrypts the recipient and stores only a keyed hash alongside', async () => {
    const { svc, prisma } = setup();
    await svc.enqueue({ kind: 'USER_REPLY', channel: 'SMS', to: '+255712345678', body: 'hi' });
    const data = prisma.notification.create.mock.calls[0][0].data;
    expect(JSON.stringify(data)).not.toContain('712345678');
    expect(crypto.decrypt(data.recipientEnc, `notification:${data.id}`)).toBe('+255712345678');
  });

  it('sends, marks SENT and wipes the recipient number', async () => {
    const gw = new FakeGateway('SMS');
    const { svc, prisma } = setup([gw]);
    expect(await svc.dispatch('n1', NOW)).toBe('sent');
    expect(gw.outbox).toEqual([{ to: '+255712345678', text: 'hello' }]);
    expect(prisma.notification.update.mock.calls[0][0].data).toMatchObject({ status: 'SENT', recipientEnc: null });
  });

  it('skips when another worker holds the lease', async () => {
    const gw = new FakeGateway('SMS');
    const { svc, prisma } = setup([gw]);
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });
    expect(await svc.dispatch('n1', NOW)).toBe('skipped');
    expect(gw.outbox).toHaveLength(0);
  });

  it('transient failure: retries later with backoff and keeps the recipient', async () => {
    const gw = { channel: 'SMS', provider: 'x', send: jest.fn().mockRejectedValue(new TransientSendError('boom')) };
    const { svc, prisma } = setup([gw]);
    expect(await svc.dispatch('n1', NOW)).toBe('retry');
    const data = prisma.notification.update.mock.calls[0][0].data;
    expect(data.attempts).toBe(1);
    expect(data.nextAttemptAt.getTime()).toBe(NOW.getTime() + backoffMs(1));
    expect(data.recipientEnc).toBeUndefined();
  });

  it('permanent failure or too many attempts: FAILED, recipient wiped, audited', async () => {
    const perm = { channel: 'SMS', provider: 'x', send: jest.fn().mockRejectedValue(new PermanentSendError('bad number')) };
    const a = setup([perm]);
    expect(await a.svc.dispatch('n1', NOW)).toBe('failed');
    expect(a.prisma.notification.update.mock.calls[0][0].data).toMatchObject({ status: 'FAILED', recipientEnc: null });
    expect(a.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'NOTIFICATION_FAILED' }));

    const flaky = { channel: 'SMS', provider: 'x', send: jest.fn().mockRejectedValue(new TransientSendError('boom')) };
    const b = setup([flaky], { attempts: MAX_ATTEMPTS - 1 });
    expect(await b.svc.dispatch('n1', NOW)).toBe('failed');
  });

  it('no gateway configured for the channel: retried, not silently dropped', async () => {
    const { svc } = setup([new FakeGateway('WHATSAPP')]);
    expect(await svc.dispatch('n1', NOW)).toBe('retry');
  });

  it('a recipient wiped before sending (e.g. delete-my-data) is never sent to', async () => {
    const gw = new FakeGateway('SMS');
    const { svc } = setup([gw], { recipientEnc: null });
    expect(await svc.dispatch('n1', NOW)).toBe('failed');
    expect(gw.outbox).toHaveLength(0);
  });

  it('processDue dispatches every due row', async () => {
    const { svc } = setup();
    expect(await svc.processDue(50, NOW)).toBe(1);
  });

  it('backoff grows and is capped at one hour', () => {
    expect(backoffMs(1)).toBe(30_000);
    expect(backoffMs(2)).toBe(60_000);
    expect(backoffMs(20)).toBe(3_600_000);
  });
});
