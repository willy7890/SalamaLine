import { MessageGateway, PermanentSendError, SendResult, TransientSendError } from './message-gateway';

export interface AfricasTalkingConfig {
  username: string;
  apiKey: string;
  baseUrl: string;
  senderId?: string;
}

/** Africa's Talking bulk SMS (POST /version1/messaging, form-encoded, `apiKey` header). */
export class AfricasTalkingGateway implements MessageGateway {
  readonly channel = 'SMS' as const;
  readonly provider = 'africastalking';
  constructor(private readonly cfg: AfricasTalkingConfig, private readonly fetchImpl: typeof fetch = fetch) {}

  async send(to: string, text: string): Promise<SendResult> {
    const body = new URLSearchParams({ username: this.cfg.username, to, message: text });
    if (this.cfg.senderId) body.set('from', this.cfg.senderId);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.cfg.baseUrl}/version1/messaging`, {
        method: 'POST',
        headers: { apiKey: this.cfg.apiKey, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new TransientSendError('SMS gateway unreachable');
    }
    if (res.status === 401 || res.status === 403) throw new PermanentSendError('SMS gateway rejected credentials');
    if (res.status >= 500 || res.status === 429) throw new TransientSendError(`SMS gateway status ${res.status}`);
    if (!res.ok) throw new PermanentSendError(`SMS gateway status ${res.status}`);

    const json = (await res.json().catch(() => null)) as {
      SMSMessageData?: { Recipients?: Array<{ status?: string; messageId?: string; statusCode?: number }> };
    } | null;
    const recipient = json?.SMSMessageData?.Recipients?.[0];
    if (!recipient) throw new TransientSendError('SMS gateway returned no recipient result');
    // AT statusCode 100/101/102 = processed/sent/queued; anything else is a per-recipient rejection.
    if (![100, 101, 102].includes(Number(recipient.statusCode))) throw new PermanentSendError(`Recipient rejected: ${recipient.status ?? 'unknown'}`);
    return { providerMessageId: recipient.messageId };
  }
}
