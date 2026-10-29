import { Channel } from '@prisma/client';

export const MESSAGE_GATEWAYS = Symbol('MESSAGE_GATEWAYS');

export interface SendResult {
  providerMessageId?: string;
}

/** Thrown for failures worth retrying (network, 5xx, rate limit). */
export class TransientSendError extends Error {}
/** Thrown for failures that will never succeed (bad number, auth rejected). */
export class PermanentSendError extends Error {}

export interface MessageGateway {
  readonly channel: Extract<Channel, 'SMS' | 'WHATSAPP'>;
  readonly provider: string;
  /** `to` is E.164. Implementations must never log `to` or `text`. */
  send(to: string, text: string): Promise<SendResult>;
}
