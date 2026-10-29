import { Injectable } from '@nestjs/common';
import { InboundChannel } from '../common/types/intent';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { splitMessage } from './sms/sms.splitter';

/** Sends replies through the durable outbox (recipient encrypted, wiped after delivery). */
@Injectable()
export class ReplyService {
  constructor(private readonly notifications: NotificationsService) {}

  async reply(channel: InboundChannel, to: string, messages: string[]): Promise<void> {
    const outbound = channel === 'WHATSAPP' ? 'WHATSAPP' : 'SMS';
    for (const message of messages) {
      for (const part of splitMessage(message, outbound === 'SMS' ? 300 : 1000)) {
        await this.notifications.enqueueAndKick({ kind: 'USER_REPLY', channel: outbound, to, body: part });
      }
    }
  }
}
