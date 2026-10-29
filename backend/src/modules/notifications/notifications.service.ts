import { Inject, Injectable, Logger } from '@nestjs/common';
import { Channel, NotificationKind } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';
import { PhoneHashService } from '../../common/crypto/phone-hash.service';
import { MESSAGE_GATEWAYS, MessageGateway, PermanentSendError } from '../../gateways/message-gateway';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export const MAX_ATTEMPTS = 8;
const LEASE_MS = 2 * 60_000;

export interface EnqueueInput {
  kind: NotificationKind;
  channel: Extract<Channel, 'SMS' | 'WHATSAPP'>;
  /** E.164 recipient. Encrypted at rest and wiped as soon as the message is sent or abandoned. */
  to: string;
  body: string;
  helpRequestId?: string;
}

export function backoffMs(attempts: number): number {
  return Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 60 * 60_000);
}

/**
 * Durable outbox. Delivery is at-least-once: a crash between the provider accepting a message and us recording
 * SENT can cause one duplicate SMS, which is the safe failure mode for safeguarding alerts.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: FieldEncryptionService,
    private readonly hashes: PhoneHashService,
    private readonly audit: AuditService,
    @Inject(MESSAGE_GATEWAYS) private readonly gateways: MessageGateway[],
  ) {}

  async enqueue(input: EnqueueInput): Promise<string> {
    const id = randomUUID();
    await this.prisma.notification.create({
      data: {
        id,
        kind: input.kind,
        channel: input.channel,
        recipientEnc: this.crypto.encrypt(input.to, `notification:${id}`),
        recipientHash: this.hashes.hash(input.to),
        body: input.body,
        helpRequestId: input.helpRequestId,
      },
    });
    return id;
  }

  /** Enqueue and attempt immediate delivery without blocking the caller; the worker retries failures. */
  async enqueueAndKick(input: EnqueueInput): Promise<string> {
    const id = await this.enqueue(input);
    void this.dispatch(id).catch(() => this.logger.warn('Immediate dispatch failed; worker will retry'));
    return id;
  }

  /** Claims a lease on the row, then sends. Safe to call concurrently from several processes. */
  async dispatch(id: string, now = new Date()): Promise<'sent' | 'retry' | 'failed' | 'skipped'> {
    const claimed = await this.prisma.notification.updateMany({
      where: { id, status: 'QUEUED', nextAttemptAt: { lte: now } },
      data: { nextAttemptAt: new Date(now.getTime() + LEASE_MS) },
    });
    if (claimed.count !== 1) return 'skipped';
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n) return 'skipped';

    if (!n.recipientEnc) return this.fail(id, 'Recipient wiped before send');
    const gateway = this.gateways.find((g) => g.channel === n.channel);
    if (!gateway) return this.retryOrFail(id, n.attempts, `No gateway configured for ${n.channel}`, false, now);

    try {
      const to = this.crypto.decrypt(n.recipientEnc, `notification:${id}`);
      await gateway.send(to, n.body);
    } catch (e) {
      const permanent = e instanceof PermanentSendError;
      const reason = e instanceof Error ? e.message : 'send failed';
      return this.retryOrFail(id, n.attempts, reason, permanent, now);
    }
    await this.prisma.notification.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date(), recipientEnc: null, attempts: { increment: 1 }, lastError: null },
    });
    return 'sent';
  }

  async processDue(limit = 50, now = new Date()): Promise<number> {
    const due = await this.prisma.notification.findMany({
      where: { status: 'QUEUED', nextAttemptAt: { lte: now } },
      select: { id: true },
      orderBy: { nextAttemptAt: 'asc' },
      take: limit,
    });
    let sent = 0;
    for (const { id } of due) if ((await this.dispatch(id, now)) === 'sent') sent += 1;
    return sent;
  }

  private async retryOrFail(id: string, attempts: number, reason: string, permanent: boolean, now: Date) {
    const next = attempts + 1;
    if (permanent || next >= MAX_ATTEMPTS) return this.fail(id, reason, next);
    await this.prisma.notification.update({
      where: { id },
      data: { attempts: next, nextAttemptAt: new Date(now.getTime() + backoffMs(next)), lastError: reason.slice(0, 200) },
    });
    return 'retry' as const;
  }

  private async fail(id: string, reason: string, attempts?: number) {
    await this.prisma.notification.update({
      where: { id },
      data: { status: 'FAILED', recipientEnc: null, lastError: reason.slice(0, 200), ...(attempts ? { attempts } : {}) },
    });
    this.logger.error(`Notification ${id} permanently failed: ${reason}`);
    await this.audit.record({ action: 'NOTIFICATION_FAILED', resourceType: 'Notification', resourceId: id, outcome: 'FAILURE' });
    return 'failed' as const;
  }
}
