import { MessageGateway, PermanentSendError, SendResult, TransientSendError } from './message-gateway';

export interface WhatsAppCloudConfig {
  phoneNumberId: string;
  accessToken: string;
  apiVersion?: string;
}

/**
 * WhatsApp Cloud API free-form text. NOTE: Meta only allows free-form text inside the 24h window after the
 * user's last message; messages outside it need an approved template (not implemented here).
 */
export class WhatsAppCloudGateway implements MessageGateway {
  readonly channel = 'WHATSAPP' as const;
  readonly provider = 'whatsapp-cloud';
  constructor(private readonly cfg: WhatsAppCloudConfig, private readonly fetchImpl: typeof fetch = fetch) {}

  async send(to: string, text: string): Promise<SendResult> {
    const version = this.cfg.apiVersion ?? 'v20.0';
    let res: Response;
    try {
      res = await this.fetchImpl(`https://graph.facebook.com/${version}/${this.cfg.phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.cfg.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: to.replace(/^\+/, ''), type: 'text', text: { body: text } }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new TransientSendError('WhatsApp API unreachable');
    }
    if (res.status === 401 || res.status === 403) throw new PermanentSendError('WhatsApp API rejected credentials');
    if (res.status >= 500 || res.status === 429) throw new TransientSendError(`WhatsApp API status ${res.status}`);
    if (!res.ok) throw new PermanentSendError(`WhatsApp API status ${res.status}`);
    const json = (await res.json().catch(() => null)) as { messages?: Array<{ id?: string }> } | null;
    return { providerMessageId: json?.messages?.[0]?.id };
  }
}
