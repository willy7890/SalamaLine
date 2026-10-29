import { Channel } from '@prisma/client';
import { MessageGateway, SendResult } from './message-gateway';

/** Development/test gateway: records messages in memory (including recipient) and sends nothing. */
export class FakeGateway implements MessageGateway {
  readonly provider = 'fake';
  readonly outbox: Array<{ to: string; text: string }> = [];
  constructor(readonly channel: Extract<Channel, 'SMS' | 'WHATSAPP'>) {}
  async send(to: string, text: string): Promise<SendResult> {
    this.outbox.push({ to, text });
    return { providerMessageId: `fake-${this.outbox.length}` };
  }
}
